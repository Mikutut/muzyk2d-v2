//#region Imports
	import { nanoid } from "nanoid";
	import { Readable } from "stream"
	import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, PlayerSubscription, getVoiceConnection, AudioPlayerError } from "@discordjs/voice";
	import { M2D_LogUtils } from "./log";
	import { M2D_EPlaylistErrorSubtypes, M2D_IPlaylistEmptyPlaylistError, M2D_IPlaylistEntry, M2D_PlaylistError, M2D_PlaylistUtils } from "./playlist";
	import { M2D_GeneralUtils, M2D_Error, M2D_IError, M2D_EErrorTypes } from "./utils";
	import { M2D_EVoiceErrorSubtypes, M2D_IVoiceDestroyedError, M2D_VoiceUtils, M2D_IVoiceConnection, M2D_IVoiceUserNotConnectedToVoiceChannelError } from "./voice";
	import { M2D_ClientUtils, M2D_EClientErrorSubtypes, M2D_IClientMissingGuildMemberError, M2D_IClientWrongChannelTypeError } from "./client";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_ICommand, M2D_CATEGORIES, M2D_ICommandParameter, M2D_ICommandParameterDesc, M2D_ICommandSuppParameters, M2D_ECommandsErrorSubtypes, M2D_ICommandsMissingSuppParametersError, M2D_ICommandsMissingParameterError, M2D_CommandUtils } from "./commands";
	import { M2D_YTAPIUtils } from "./youtubeapi";
//#endregion

//#region Types
	const enum M2D_PlaybackState {
		Running = "RUNNING",
		Paused = "PAUSED",
		ManuallyStopped = "MANUALLY_STOPPED",
		Stopped = "STOPPED",
		Unknown = "UNKNOWN"
	};
	const enum M2D_PlaybackMode {
		Normal = "NORMAL",
		LoopOne = "LOOP_ONE",
		LoopPlaylist = "LOOP_PLAYLIST"
	};
	interface M2D_IPlayback {
		id: string;
		guildId: string;
		state: M2D_PlaybackState;
		mode: M2D_PlaybackMode;
		audioPlayer: AudioPlayer;
		currentPlaylistEntryId: string;
		idleStateElapsedTime: number;
		audioStream: Readable | null;
		isCurrentlyDownloadingStream: boolean;
	}
	//#region Error types
		const enum M2D_EPlaybackErrorSubtypes {
			Exists = "EXISTS",
			DoesntExist = "DOESNT_EXIST",
			CouldntPause = "COULDNT_PAUSE",
			CouldntUnpause = "COULDNT_UNPAUSE",
			CouldntStop = "COULDNT_STOP",
			PlayerSubscription = "PLAYER_SUBSCRIPTION",
			AlreadyDownloadingStream = "ALREADY_DOWNLOADING_STREAM"
		};
		interface M2D_IPlaybackExistsError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IPlaybackDoesntExistError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IPlaybackCouldntPauseError extends M2D_IError {
			data: {
				guildId: string;
				currentState: M2D_PlaybackState;
			}
		};
		interface M2D_IPlaybackCouldntUnpauseError extends M2D_IError {
			data: {
				guildId: string;
				currentState: M2D_PlaybackState;
			}
		};
		interface M2D_IPlaybackCouldntStopError extends M2D_IError {
			data: {
				guildId: string;
				currentState: M2D_PlaybackState;
			}
		};
		interface M2D_IPlaybackPlayerSubscriptionError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IPlaybackAlreadyDownloadingStreamError extends M2D_IError {
			data: {
				guildId: string;
			}
		};

		type M2D_PlaybackError = M2D_IPlaybackExistsError |
			M2D_IPlaybackDoesntExistError |
			M2D_IPlaybackCouldntPauseError |
			M2D_IPlaybackCouldntUnpauseError |
			M2D_IPlaybackCouldntStopError |
			M2D_IPlaybackPlayerSubscriptionError |
			M2D_IPlaybackAlreadyDownloadingStreamError;
	//#endregion
//#endregion

let M2D_InactiveTimeout: number;
const M2D_PLAYBACKS: M2D_IPlayback[] = [];

const M2D_PlaybackTimer = setInterval(async () => {
	for(const [i, v] of M2D_PLAYBACKS.entries()) {
		if(v.state === M2D_PlaybackState.Stopped) {
			if(v.mode === M2D_PlaybackMode.LoopOne) {
				await M2D_PlaylistUtils.getEntry(v.guildId, v.currentPlaylistEntryId)
					.then((pe: M2D_IPlaylistEntry) => M2D_PlaybackUtils.playPlaylistEntry(v.guildId, pe.id))
					.then(() => M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - zapętlono utwór.`))
					.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${v.guildId}" | PlID: "${v.id}" - nie udało się zapętlić utworu.`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]));
			} else {
				await M2D_PlaybackUtils.playNextPlaylistEntry(v.guildId)
					.then(() => M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - odtworzono następny utwór na playliście.`))
					.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${v.guildId}" | PlID: "${v.id}" - wystąpił błąd podczas odtwarzania następnego utworu na playliście!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]));
			}
		}
		
		if(v.state === M2D_PlaybackState.Paused || v.state === M2D_PlaybackState.Stopped || v.state === M2D_PlaybackState.ManuallyStopped) {
			if(v.idleStateElapsedTime < M2D_InactiveTimeout) {
				M2D_PLAYBACKS[i].idleStateElapsedTime++;
			} else {
				await M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - upłynął dozwolony czas nieaktywności. Niszczenie odtworzenia...`)
					.then(() => M2D_PlaybackUtils.destroyPlayback(v.guildId))
					.catch((err: M2D_PlaybackError) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${v.guildId}" | PlID: "${v.id}" - wystąpił błąd podczas niszczenia odtworzenia!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ]));
			}
		} else {
			M2D_PLAYBACKS[i].idleStateElapsedTime = 0;
		}

		await M2D_VoiceUtils.isVoiceConnectionDisconnected(v.guildId)
			.then((isDis: boolean) => {
				if(isDis) {
					return M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - brak kanału głosowego, do którego dołączono. Niszczenie...`)
						.then(() => M2D_PlaybackUtils.destroyPlayback(v.guildId)
						.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${v.guildId}" | PlID: "${v.id}" - nie udało się zniszczyć odtworzenia`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]))
					);
				}
			})
			.catch(() => M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - brak kanału głosowego, do którego dołączono. Niszczenie...`)
				.then(() => M2D_PlaybackUtils.destroyPlayback(v.guildId)
					.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${v.guildId}" | PlID: "${v.id}" - nie udało się zniszczyć odtworzenia`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]))
				)
			);
	}
}, 1000);

const M2D_PlaybackUtils = {
	doesPlaybackExist: (guildId: string) => M2D_PLAYBACKS.find((v) => v.guildId === guildId) !== undefined,
	getPlayback: (guildId: string) => new Promise<M2D_IPlayback>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			res(M2D_PLAYBACKS.find((v) => v.guildId === guildId) as M2D_IPlayback);
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError);
	}),
	createPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano stworzenie odtworzenia na serwerze o ID "${guildId}"...`)
			.then(() => { 
				if(!M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
					M2D_PlaylistUtils.getFirstEntry(guildId)
						.then((entry: M2D_IPlaylistEntry) => {
							if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
								M2D_VoiceUtils.getVoiceConnection(guildId)
									.then((vcData: M2D_IVoiceConnection) => {
										const plId = nanoid(10);
										const aP = new AudioPlayer();

										const vc = getVoiceConnection(guildId);

										if(vc) {	
											const pS = vc.subscribe(aP);

											if(pS) {
												M2D_VoiceUtils.addPlayerSubscription(guildId, pS)
													.then(() => {
														const playback: M2D_IPlayback = {	
															id: plId,
															guildId,
															state: M2D_PlaybackState.Running,
															mode: M2D_PlaybackMode.Normal,
															audioPlayer: aP,
															audioStream: null,
															currentPlaylistEntryId: entry.id,
															idleStateElapsedTime: 0,
															isCurrentlyDownloadingStream: false
														};
														aP.on("stateChange", (oldState, newState) => {
															const oldStatusString: string = (oldState.status === AudioPlayerStatus.Playing) ? "PLAYING" :
																(oldState.status === AudioPlayerStatus.Buffering) ? "BUFFERING" :
																(oldState.status === AudioPlayerStatus.Idle) ? "IDLE" :
																(oldState.status === AudioPlayerStatus.Paused) ? "PAUSED" :
																(oldState.status === AudioPlayerStatus.AutoPaused) ? "AUTO_PAUSED" : 
																"UNKNOWN";
															const newStatusString: string = (newState.status === AudioPlayerStatus.Playing) ? "PLAYING" :
																(newState.status === AudioPlayerStatus.Buffering) ? "BUFFERING" :
																(newState.status === AudioPlayerStatus.Idle) ? "IDLE" :
																(newState.status === AudioPlayerStatus.Paused) ? "PAUSED" :
																(newState.status === AudioPlayerStatus.AutoPaused) ? "AUTO_PAUSED" : 
																"UNKNOWN";

															M2D_LogUtils.logMessage(`info`, `GID: "${playback.guildId}" | PlID: "${playback.id}" - nastąpiła zmiana stanu z "${oldStatusString}" do "${newStatusString}"`)
																.then(() => {
																	if(newStatusString === "BUFFERING" || newStatusString === "PLAYING") {
																		playback.state = M2D_PlaybackState.Running;
																	} else if(newStatusString === "PAUSED" || newStatusString === "AUTO_PAUSED") {
																		playback.state = M2D_PlaybackState.Paused;
																	} else if(newStatusString === "IDLE") {
																		if(playback.state !== M2D_PlaybackState.ManuallyStopped) playback.state = M2D_PlaybackState.Stopped;
																	} else {
																		playback.state = M2D_PlaybackState.Unknown;
																	}
																});
														});
														aP.on("error", (error: AudioPlayerError) => {
															M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | PlID: "${plId}" - wystąpił błąd podczas odtwarzania!`, `Oznaczenie błędu: "${error.name}"`, `Treść błędu: "${error.message}"` ])
																.then(() => M2D_PlaybackUtils.destroyPlayback(guildId))
																.then(() => M2D_ClientUtils.sendMessageInGuild(guildId, undefined, {
																	embeds: [
																		M2D_GeneralUtils.embedBuilder({
																			type: "error",
																			title: "Błąd odtwarzania!",
																			description: "Wystąpił błąd **podczas odtwarzania pozycji**!\nNajprawdopodobniej jest to problem z **biblioteką \"ytdl-core-discord\"**, na którą niestety **nie mam żadnego wpływu**.\n\nUżyj komendy `odtwórz` (`p`), aby **jeszcze raz odtworzyć obecną pozycję**."
																		})
																	]
																})
																	.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" - nie udało się poinformować o błędzie odtwarzania!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ]))
																)
																.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${guildId}" | PlID: "${plId}" - nie udało się zniszczyć wadliwego odtworzenia!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ]));
														})

														M2D_PLAYBACKS.push(playback);
														M2D_LogUtils.logMessage(`success`, `Pomyślnie stworzono odtworzenie na serwerze o ID "${guildId}"!`)
															.then(() => res());
													})
													.catch((err) => rej(err));
											} else rej({
												type: M2D_EErrorTypes.Playback,
												subtype: M2D_EPlaybackErrorSubtypes.PlayerSubscription,
												data: { guildId }
											} as M2D_IPlaybackPlayerSubscriptionError);
										} else rej({
											type: M2D_EErrorTypes.Voice,
											subtype: M2D_EVoiceErrorSubtypes.Destroyed,
											data: {
												guildId
											}
										} as M2D_IVoiceDestroyedError);
									})
									.catch((err) => rej(err));
							} else M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas tworzenia odtworzenia!`, `Powód: Nie podłączono do żadnego kanału głosowego na serwerze o ID "${guildId}"`])
								.then(() => rej({
									type: M2D_EErrorTypes.Voice,
									subtype: M2D_EVoiceErrorSubtypes.Destroyed,
									data: {
										guildId
									}
								} as M2D_IVoiceDestroyedError));
						})
						.catch(() => M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas tworzenia odtworzenia!`, `Powód: Playlista dla serwera o ID "${guildId}" jest pusta!`])
							.then(() => rej({
								type: M2D_EErrorTypes.Playlist,
								subtype: M2D_EPlaylistErrorSubtypes.EmptyPlaylist,
								data: {
									guildId
								}
							} as M2D_IPlaylistEmptyPlaylistError))
						)
				} else M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas tworzenia odtworzenia!`, `Powód: Odtworzenie już istnieje na serwerze o ID "${guildId}"`])
					.then(() => rej({
						type: M2D_EErrorTypes.Playback,
						subtype: M2D_EPlaybackErrorSubtypes.Exists,
						data: {
							guildId
						}
					} as M2D_IPlaybackExistsError));
			});
	}),
	destroyPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			const idx = M2D_PLAYBACKS.findIndex((v) => v.guildId === guildId);
	
			M2D_VoiceUtils.deletePlayerSubscription(guildId)
				.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${guildId}" | VCID: "${M2D_PLAYBACKS[idx].id}" - nie udało się usunąć subskrypcji odtwarzacza`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]))
				.finally(() => {
					if(M2D_PLAYBACKS[idx].audioStream !== null) { 
						(M2D_PLAYBACKS[idx].audioStream as Readable).destroy();
						M2D_PLAYBACKS[idx].audioStream = null;
					}
					M2D_PLAYBACKS.splice(idx, 1);
					res();
				})
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError)
	}),
	pausePlayback: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			const idx = M2D_PLAYBACKS.findIndex((v) => v.guildId === guildId);

			if(M2D_PLAYBACKS[idx].audioPlayer.pause(true)) res();
			else rej({
				type: M2D_EErrorTypes.Playback,
				subtype: M2D_EPlaybackErrorSubtypes.CouldntPause,
				data: {
					guildId,
					currentState: M2D_PLAYBACKS[idx].state
				}
			} as M2D_IPlaybackCouldntPauseError);
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError);
	}),
	unpausePlayback: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			const idx = M2D_PLAYBACKS.findIndex((v) => v.guildId === guildId);

			if(M2D_PLAYBACKS[idx].audioPlayer.unpause()) res();
			else rej({
				type: M2D_EErrorTypes.Playback,
				subtype: M2D_EPlaybackErrorSubtypes.CouldntUnpause,
				data: {
					guildId,
					currentState: M2D_PLAYBACKS[idx].state
				}
			} as M2D_IPlaybackCouldntUnpauseError);
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError);
	}),
	playAudioOnPlayback: (guildId: string, stream: Readable) => new Promise<void>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			const idx = M2D_PLAYBACKS.findIndex((v) => v.guildId === guildId);

			const audioResource = createAudioResource(stream, {
				silencePaddingFrames: 5	
			});
			M2D_PLAYBACKS[idx].audioPlayer.play(audioResource);
			M2D_PLAYBACKS[idx].audioStream = stream;
			res();
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError);
	}),
	playPlaylistEntry: (guildId: string, entryId: string) => new Promise<void>((res, rej) => {
		M2D_PlaybackUtils.getPlayback(guildId)
			.then((pB) => {
				if(!pB.isCurrentlyDownloadingStream) {
					const idx = M2D_PLAYBACKS.findIndex((v) => v.id === pB.id && v.guildId === pB.guildId);

					M2D_PLAYBACKS[idx].isCurrentlyDownloadingStream = true;

					if(M2D_PLAYBACKS[idx].audioStream !== null) {
						(M2D_PLAYBACKS[idx].audioStream as Readable).destroy();
						M2D_PLAYBACKS[idx].audioStream = null;
					}

					return pB;
				} else return Promise.reject({
					type: M2D_EErrorTypes.Playback,
					subtype: M2D_EPlaybackErrorSubtypes.AlreadyDownloadingStream,
					data: {
						guildId
					}
				} as M2D_IPlaybackAlreadyDownloadingStreamError);
			})
			.then((pB) => M2D_PlaylistUtils.getEntry(guildId, entryId)
				.then((pe) => M2D_YTAPIUtils.getVideoStream(pe.url))
				.then((stream) => M2D_PlaybackUtils.playAudioOnPlayback(guildId, stream))
				.then(() => {
					const idx = M2D_PLAYBACKS.findIndex((v) => v.id === pB.id && v.guildId === pB.guildId);

					M2D_PLAYBACKS[idx].currentPlaylistEntryId = entryId;
					M2D_PLAYBACKS[idx].isCurrentlyDownloadingStream = false;
				})
			)
			.then(() => res())
			.catch((err) => rej(err));
	}),
	playCurrentPlaylistEntry: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_PlaybackUtils.getPlayback(guildId)
			.then((pB) => M2D_PlaybackUtils.playPlaylistEntry(guildId, pB.currentPlaylistEntryId))
			.then(() => res())
			.catch((err) => rej(err));
	}),
	playNextPlaylistEntry: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_PlaybackUtils.getPlayback(guildId)
			.then((pB: M2D_IPlayback) => M2D_PlaylistUtils.getNextEntry(guildId, pB.currentPlaylistEntryId)
				.catch((err: M2D_PlaylistError) => {
					if(err.subtype === M2D_EPlaylistErrorSubtypes.EndOfPlaylistReached) {
						return M2D_PlaylistUtils.getFirstEntry(guildId);
					} else return Promise.reject(err);
				})
			)
			.then((pe) => M2D_PlaybackUtils.playPlaylistEntry(guildId, pe.id))
			.then(() => res())
			.catch((err) => rej(err));
	}),
	stopPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			const idx = M2D_PLAYBACKS.findIndex((v) => v.guildId === guildId);

			if(M2D_PLAYBACKS[idx].audioPlayer.stop()) {
				if(M2D_PLAYBACKS[idx].audioStream !== null) { 
					(M2D_PLAYBACKS[idx].audioStream as Readable).destroy();
					M2D_PLAYBACKS[idx].audioStream = null;
				}
				M2D_PLAYBACKS[idx].state = M2D_PlaybackState.ManuallyStopped;
				res();
			}
			else rej({
				type: M2D_EErrorTypes.Playback,
				subtype: M2D_EPlaybackErrorSubtypes.CouldntStop,
				data: {
					guildId,
					currentState: M2D_PLAYBACKS[idx].state
				}
			} as M2D_IPlaybackCouldntStopError);
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError);
	}),
	changePlaybackMode: (guildId: string, mode: M2D_PlaybackMode) => new Promise<void>((res, rej) => {
		if(M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
			const idx = M2D_PLAYBACKS.findIndex((v) => v.guildId === guildId);

			M2D_PLAYBACKS[idx].mode = mode;
			res();
		} else rej({
			type: M2D_EErrorTypes.Playback,
			subtype: M2D_EPlaybackErrorSubtypes.DoesntExist,
			data: {
				guildId
			}
		} as M2D_IPlaybackDoesntExistError);
	}),
	initPlaybackCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizacja możliwości odtwarzania...`)
			.then(() => M2D_ConfigUtils.getConfigValue("inactiveTimeout"))
			.then((val: string) => {
				M2D_InactiveTimeout = parseInt(val, 10);
			})
			.then(() => M2D_CommandUtils.addCommands(M2D_PLAYBACK_COMMANDS))
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano możliwości odtwarzania!`))
			.then(() => res())
			.catch((err) => rej(err));
	}),
	playbackExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie możliwości odtwarzania...`)
			.then(() => {
				const promisesToHandle: Promise<void>[] = [];
				for(const [i, v] of M2D_PLAYBACKS.entries()) {
					promisesToHandle.push(M2D_PlaybackUtils.destroyPlayback(v.guildId));
				}
				Promise.all(promisesToHandle);
			})
			.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono możliwości odtwarzania!`))
			.then(() => res())
			.catch((err) => rej(err));
	})
};

const M2D_PLAYBACK_COMMANDS: M2D_ICommand[] = [
	{
		name: "odtwórz",
		aliases: ["p"],
		category: M2D_CATEGORIES.playback,
		description: "Odtwarza obecną pozycję na playliście",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.getVoiceConnection(guild.id)
					.catch(() => {
						const u_GM = guild.members.cache.find((v) => v.user === user);

						if(u_GM) {
							if(u_GM.voice.channel !== null) {
								return M2D_VoiceUtils.createVoiceConnection(guild.id, u_GM.voice.channel.id);
							} else rej({
								type: M2D_EErrorTypes.Voice,
								subtype: M2D_EVoiceErrorSubtypes.UserNotConnectedToVoiceChannel,
								data: {
									guildId: guild.id,
									userId: user.id
								}
							} as M2D_IVoiceUserNotConnectedToVoiceChannelError);
						} else rej({
							type: M2D_EErrorTypes.Client,
							subtype: M2D_EClientErrorSubtypes.MissingGuildMember,
							data: {
								guildId: guild.id,
								userId: user.id
							}
						} as M2D_IClientMissingGuildMemberError)
					})
					.then(() => M2D_PlaybackUtils.getPlayback(guild.id)
						.catch(() => M2D_PlaybackUtils.createPlayback(guild.id))
					)
					.then(() => M2D_PlaybackUtils.playCurrentPlaylistEntry(guild.id))
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: `Odtworzono!`,
								description: `**Rozpoczęto odtwarzanie** obecnej pozycji na playliście!`
							})
						]
					}))
					.then(() => res())
					.catch(err => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "zapauzuj",
		aliases: ["z"],
		category: M2D_CATEGORIES.playback,
		description: "Pauzuje odtworzenie",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.getVoiceConnection(guild.id)
					.then(() => M2D_PlaybackUtils.getPlayback(guild.id))
					.then(() => M2D_PlaybackUtils.pausePlayback(guild.id))
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: `Zapauzowano!`,
								description: `Pomyślnie **zapauzowano odtwarzanie**!`
							})
						]
					}))
					.then(() => res())
					.catch(err => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "odpauzuj",
		aliases: ["oz"],
		category: M2D_CATEGORIES.playback,
		description: "Odpauzowywuje odtworzenie",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.getVoiceConnection(guild.id)
					.then(() => M2D_PlaybackUtils.getPlayback(guild.id))
					.then(() => M2D_PlaybackUtils.unpausePlayback(guild.id))
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: `Odpauzowano!`,
								description: `Pomyślnie **odpauzowano odtwarzanie**!`
							})
						]
					}))
					.then(() => res())
					.catch(err => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "stop",
		aliases: ["s"],
		category: M2D_CATEGORIES.playback,
		description: "Zatrzymuje odtwarzanie, cofając je do początku obecnego utworu",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.getVoiceConnection(guild.id)
					.then(() => M2D_PlaybackUtils.getPlayback(guild.id))
					.then(() => M2D_PlaybackUtils.stopPlayback(guild.id))
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: `Zastopowano!`,
								description: `Pomyślnie **zastopowano odtwarzanie**!`
							})
						]
					}))
					.then(() => res())
					.catch(err => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "pomiń",
		aliases: ["pp"],
		category: M2D_CATEGORIES.playback,
		description: "Pomija obecną pozycję na playliście i rozpoczyna odtwarzanie następnej",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_VoiceUtils.getVoiceConnection(guild.id)
					.then(() => M2D_PlaybackUtils.playNextPlaylistEntry(guild.id))			
					.then(() => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: `Przewinięto pozycję!`,
								description: `Pomyślnie **przewinięto do następnej pozycji na playliście**!`
							})
						]
					}))
					.then(() => res())
					.catch(err => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	},
	{
		name: "przełączTryb",
		aliases: ["pt"],
		category: M2D_CATEGORIES.playback,
		description: "Przełącza tryb odtwarzania",
		parameters: [],
		active: true,
		developerOnly: false,
		chatInvokable: true,
		isUtilCommand: false,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				const { message, guild, channel, user } = suppParameters;

				M2D_PlaybackUtils.getPlayback(guild.id)
					.then((pb) => M2D_PlaybackUtils.changePlaybackMode(guild.id, 
						(pb.mode === M2D_PlaybackMode.Normal) ? M2D_PlaybackMode.LoopPlaylist :
						(pb.mode === M2D_PlaybackMode.LoopPlaylist) ? M2D_PlaybackMode.LoopOne :
						M2D_PlaybackMode.Normal
					)
						.then(() => pb)
					)
					.then(pb => M2D_ClientUtils.sendMessageReplyInGuild(message, {
						embeds: [
							M2D_GeneralUtils.embedBuilder({
								type: "success",
								title: "Przełączono tryb!",
								description: `Zmieniono tryb odtwarzania na **${
									(pb.mode === M2D_PlaybackMode.Normal) ? "Normalny" :
									(pb.mode === M2D_PlaybackMode.LoopPlaylist) ? "Zapętlanie playlisty" :
									"Zapętlanie pozycji"
								}**`
							})
						]
					}))
					.then(() => res())
					.catch((err) => rej(err));
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError);
		}),
		errorHandler: (error, cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			rej(error);
		})
	}
];

//#region Exports
	export type {
		M2D_IPlayback,
		M2D_IPlaybackExistsError,
		M2D_IPlaybackDoesntExistError,
		M2D_IPlaybackCouldntPauseError,
		M2D_IPlaybackCouldntUnpauseError,
		M2D_IPlaybackCouldntStopError,
		M2D_IPlaybackPlayerSubscriptionError,
		M2D_IPlaybackAlreadyDownloadingStreamError,
		M2D_PlaybackError,
	};
	export {
		M2D_EPlaybackErrorSubtypes,
		M2D_PlaybackState,
		M2D_PlaybackMode,
		M2D_PlaybackUtils
	};
//#endregion