//#region Imports
	import { AudioPlayer, createAudioPlayer } from "@discordjs/voice";
	import { M2D_LogUtils } from "log";
	import { M2D_EPlaylistErrorSubtypes, M2D_IPlaylistEmptyPlaylistError, M2D_IPlaylistEntry, M2D_PlaylistUtils } from "playlist";
	import { M2D_GeneralUtils, M2D_Error, M2D_IError, M2D_EErrorTypes } from "utils";
	import { M2D_EVoiceErrorSubtypes, M2D_IVoiceAlreadyDisconnectedError, M2D_VoiceUtils } from "voice";
//#endregion

//#region Types
	const enum M2D_PlaybackState {
		Running = "RUNNING",
		Paused = "PAUSED",
		Stopped = "STOPPED"
	};
	const enum M2D_PlaybackMode {
		Normal = "NORMAL",
		LoopOne = "LOOP_ONE",
		LoopPlaylist = "LOOP_PLAYLIST"
	};
	interface M2D_IPlayback {
		guildId: string;
		state: M2D_PlaybackState;
		mode: M2D_PlaybackMode;
		audioPlayer: AudioPlayer;
		currentPlaylistEntryId: string;
	}
	//#region Error types
		const enum M2D_EPlaybackErrorSubtypes {
			AlreadyExists = "ALREADY_EXISTS",
			AlreadyDoesntExist = "ALREADY_DOESNT_EXIST"
		};
		interface M2D_IPlaybackAlreadyExistsError extends M2D_IError {
			data: {
				guildId: string;
			}
		};
		interface M2D_IPlaybackAlreadyDoesntExistError extends M2D_IError {
			data: {
				guildId: string;
			}
		};

		type M2D_PlaybackError = M2D_IPlaybackAlreadyExistsError |
			M2D_IPlaybackAlreadyDoesntExistError;
	//#endregion
//#endregion

const M2D_PLAYBACKS: M2D_IPlayback[] = [];

const M2D_PlaybackUtils = {
	doesPlaybackExist: (guildId: string) => M2D_PLAYBACKS.find((v) => v.guildId === guildId) !== undefined,
	createPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano stworzenie odtworzenia na serwerze o ID "${guildId}"...`)
			.then(() => { 
				if(!M2D_PlaybackUtils.doesPlaybackExist(guildId)) {
					M2D_PlaylistUtils.getFirstEntry(guildId)
						.then((entry: M2D_IPlaylistEntry) => {
							if(M2D_VoiceUtils.doesVoiceConnectionExistOnGuild(guildId)) {
								const aP = new AudioPlayer();
								M2D_PLAYBACKS.push({
									guildId,
									state: M2D_PlaybackState.Running,
									mode: M2D_PlaybackMode.Normal,
									audioPlayer: aP,
									currentPlaylistEntryId: entry.id
								});
								M2D_LogUtils.logMessage(`success`, `Pomyślnie stworzono odtworzenie na serwerze o ID "${guildId}"!`)
									.then(() => res());
							} else M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas tworzenia odtworzenia!`, `Powód: Nie podłączono do żadnego kanału głosowego na serwerze o ID "${guildId}"`)
								.then(() => rej({
									type: M2D_EErrorTypes.Voice,
									subtype: M2D_EVoiceErrorSubtypes.AlreadyDisconnected,
									data: {
										guildId
									}
								} as M2D_IVoiceAlreadyDisconnectedError));
						})
						.catch(() => M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas tworzenia odtworzenia!`, `Powód: Playlista dla serwera o ID "${guildId}" jest pusta!`)
							.then(() => rej({
								type: M2D_EErrorTypes.Playlist,
								subtype: M2D_EPlaylistErrorSubtypes.EmptyPlaylist,
								data: {
									guildId
								}
							} as M2D_IPlaylistEmptyPlaylistError))
						)
				} else M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas tworzenia odtworzenia!`, `Powód: Odtworzenie już istnieje na serwerze o ID "${guildId}"`)
					.then(() => rej({
						type: M2D_EErrorTypes.Playback,
						subtype: M2D_EPlaybackErrorSubtypes.AlreadyExists,
						data: {
							guildId
						}
					} as M2D_IPlaybackAlreadyExistsError));
			});
	}),
	destroyPlayback: (guildId: string) => new Promise<void>((res, rej) => {

	}),
	pausePlayback: (guildId: string) => new Promise<void>((res, rej) => {

	}),
	unpausePlayback: (guildId: string) => new Promise<void>((res, rej) => {
		
	}),
	playAudioOnPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		
	}),
	stopPlayback: (guildId: string) => new Promise<void>((res, rej) => {
		
	}),
	initPlaybackCapabilities: () => new Promise<void>((res, rej) => {

	})
};

//#region Exports
	export type {
		M2D_IPlayback,
		M2D_IPlaybackAlreadyExistsError,
		M2D_IPlaybackAlreadyDoesntExistError,
		M2D_PlaybackError
	};
	export {
		M2D_EPlaybackErrorSubtypes,
		M2D_PlaybackState,
		M2D_PlaybackMode,
		M2D_PlaybackUtils
	};
//#endregion