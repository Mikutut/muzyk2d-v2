//#region Imports
	import { nanoid } from "nanoid";
	import { Readable } from "stream"
	import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource } from "@discordjs/voice";
	import { M2D_LogUtils } from "log";
	import { M2D_EPlaylistErrorSubtypes, M2D_IPlaylistEmptyPlaylistError, M2D_IPlaylistEntry, M2D_PlaylistError, M2D_PlaylistUtils } from "./playlist";
	import { M2D_GeneralUtils, M2D_Error, M2D_IError, M2D_EErrorTypes } from "./utils";
	import { M2D_EVoiceErrorSubtypes, M2D_IVoiceDestroyedError, M2D_VoiceUtils } from "./voice";
	import { M2D_ClientUtils } from "./client";
	import { M2D_ConfigUtils } from "./config";
	import { M2D_ICommand, M2D_CATEGORIES, M2D_ICommandParameter, M2D_ICommandParameterDesc, M2D_ICommandSuppParameters, M2D_ECommandsErrorSubtypes, M2D_ICommandsMissingSuppParametersError, M2D_ICommandsMissingParameterError } from "./commands";
import { M2D_YTAPIUtils } from "youtubeapi";
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
	}
	//#region Error types
		const enum M2D_EPlaybackErrorSubtypes {
			Exists = "EXISTS",
			DoesntExist = "DOESNT_EXIST",
			CouldntPause = "COULDNT_PAUSE",
			CouldntUnpause = "COULDNT_UNPAUSE",
			CouldntStop = "COULDNT_STOP",
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

		type M2D_PlaybackError = M2D_IPlaybackExistsError |
			M2D_IPlaybackDoesntExistError |
			M2D_IPlaybackCouldntPauseError |
			M2D_IPlaybackCouldntUnpauseError |
			M2D_IPlaybackCouldntStopError;
	//#endregion
//#endregion

let M2D_InactiveTimeout: number;
const M2D_PLAYBACKS: M2D_IPlayback[] = [];

const M2D_PlaybackTimer = setInterval(() => {
	for(const [i, v] of M2D_PLAYBACKS.entries()) {
		if(v.state === M2D_PlaybackState.Stopped) {
			if(v.mode === M2D_PlaybackMode.LoopOne) {
				M2D_PlaylistUtils.getEntry(v.guildId, v.currentPlaylistEntryId)
					.then((pe: M2D_IPlaylistEntry) => M2D_YTAPIUtils.getVideoStream(pe.url))
					.then((stream: Readable) => M2D_PlaybackUtils.playAudioOnPlayback(v.guildId, stream))
					.then(() => M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - zapętlono utwór.`))
					.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, [`GID: "${v.guildId}" | PlID: "${v.id}" - nie udało się zapętlić utworu.`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"`]));
			} else {
				M2D_PlaylistUtils.getNextEntry(v.guildId, v.currentPlaylistEntryId)
					.then((pe: M2D_IPlaylistEntry) => M2D_YTAPIUtils.getVideoStream(pe.url)
						.then((stream: Readable) => M2D_PlaybackUtils.playAudioOnPlayback(v.guildId, stream))
						.then(() => M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - odtworzono następny utwór na playliście.`))
					)
					.catch((err: M2D_Error) => {
						if(err.subtype === M2D_EPlaylistErrorSubtypes.EndOfPlaylistReached) {
							return M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - osiągnięto koniec playlisty.`)
						}
					})
					.then(() => {
						if(v.mode === M2D_PlaybackMode.LoopPlaylist) {
							return M2D_PlaylistUtils.getFirstEntry(v.guildId)
								.then((pe: M2D_IPlaylistEntry) => M2D_YTAPIUtils.getVideoStream(pe.url))
								.then((stream: Readable) => M2D_PlaybackUtils.playAudioOnPlayback(v.guildId, stream))
								.then(() => M2D_LogUtils.logMessage(`success`, `GID: "${v.guildId}" | PlID: "${v.id}" - zapętlono playlistę.`));
						} else return M2D_LogUtils.logMessage(`warn`, `GID: "${v.guildId}" | PlID: "${v.id}" - ustawiono tryb odtwarzania na "NORMAL" - stopowanie odtwarzania...`);
					})
					.catch((err: M2D_PlaylistError) => M2D_LogUtils.logMessage(`error`, `GID: "${v.guildId}" | PlID: "${v.id}" - nie udało się wczytać pierwszej pozycji playlisty!`));
			}
		}
		
		if(v.state === M2D_PlaybackState.Paused || v.state === M2D_PlaybackState.Stopped || v.state === M2D_PlaybackState.ManuallyStopped) {
			if(v.idleStateElapsedTime < M2D_InactiveTimeout) {
				M2D_PLAYBACKS[i].idleStateElapsedTime++;
			} else {
				M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - upłynął dozwolony czas nieaktywności. Niszczenie odtworzenia...`)
					.then(() => M2D_PlaybackUtils.destroyPlayback(v.guildId))
					.catch((err: M2D_PlaybackError) => M2D_LogUtils.logMultipleMessages(`error`, [ `GID: "${v.guildId}" | PlID: "${v.id}" - wystąpił błąd podczas niszczenia odtworzenia!`, `Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `Dane o błędzie: "${JSON.stringify(err.data)}"` ]));
			}
		} else {
			M2D_PLAYBACKS[i].idleStateElapsedTime = 0;
		}

		M2D_VoiceUtils.isVoiceConnectionDisconnected(v.guildId)
			.then((isDis: boolean) => {
				if(isDis) {
					return M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - brak kanału głosowego, do którego dołączono. Niszczenie...`)
				}
			})
			.catch(() => M2D_LogUtils.logMessage(`info`, `GID: "${v.guildId}" | PlID: "${v.id}" - brak kanału głosowego, do którego dołączono. Niszczenie...`))
			.then(() => M2D_PlaybackUtils.destroyPlayback(v.guildId))
			.catch(() => M2D_LogUtils.logMessage(`error`, `GID: "${v.guildId}" | PlID: "${v.id}" - nie udało się zniszczyć odtworzenia`));
	}
}, 1000);

const M2D_PlaybackUtils = {
	doesPlaybackExist: (guildId: string) => M2D_PLAYBACKS.find((v) => v.guildId === guildId) !== undefined,
	createPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano stworzenie odtworzenia na serwerze o ID "${guildId}"...`)
			.then(() => { 
				if(!M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
					M2D_PlaylistUtils.getFirstEntry(guildId)
						.then((entry: M2D_IPlaylistEntry) => {
							if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
								const plId = nanoid(10);
								const aP = new AudioPlayer();
								const playback: M2D_IPlayback = {	
									id: plId,
									guildId,
									state: M2D_PlaybackState.Running,
									mode: M2D_PlaybackMode.Normal,
									audioPlayer: aP,
									audioStream: null,
									currentPlaylistEntryId: entry.id,
									idleStateElapsedTime: 0
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
								M2D_PLAYBACKS.push(playback);
								M2D_LogUtils.logMessage(`success`, `Pomyślnie stworzono odtworzenie na serwerze o ID "${guildId}"!`)
									.then(() => res());
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
	
			if(M2D_PLAYBACKS[idx].audioPlayer.stop(true)) {
				if(M2D_PLAYBACKS[idx].audioStream !== null) { 
					(M2D_PLAYBACKS[idx].audioStream as Readable).destroy();
					M2D_PLAYBACKS[idx].audioStream = null;
				}
				M2D_PLAYBACKS.splice(idx, 1);
				res();
			} else rej({
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

			const audioResource = createAudioResource(stream);
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
				subtype: M2D_EPlaybackErrorSubtypes.CouldntUnpause,
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

];

//#region Exports
	export type {
		M2D_IPlayback,
		M2D_IPlaybackExistsError,
		M2D_IPlaybackDoesntExistError,
		M2D_IPlaybackCouldntPauseError,
		M2D_IPlaybackCouldntUnpauseError,
		M2D_IPlaybackCouldntStopError,
		M2D_PlaybackError,
	};
	export {
		M2D_EPlaybackErrorSubtypes,
		M2D_PlaybackState,
		M2D_PlaybackMode,
		M2D_PlaybackUtils
	};
//#endregion