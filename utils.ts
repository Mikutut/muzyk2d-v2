//#region Imports
	import { version as M2DVersion } from "./package.json";
	import { config as dotenvConfig } from "dotenv";
	import { EmbedField, MessageEmbed } from "discord.js";
	import { M2D_ConfigUtils, M2D_EConfigErrorSubtypes, M2D_ConfigError } from "./config";
	import { M2D_LogUtils, M2D_ELogErrorSubtypes, M2D_LogError } from "./log";
	import { M2D_EClientErrorSubtypes, M2D_ClientError } from "./client";
	import { M2D_ECommandsErrorSubtypes, M2D_CommandsError } from "./commands";
	import { M2D_EVoiceErrorSubtypes, M2D_VoiceError, M2D_VoiceUtils } from "./voice";
	import { M2D_EPlaylistErrorSubtypes, M2D_PlaylistError, M2D_PlaylistUtils } from "./playlist";
	import { M2D_EPlaybackErrorSubtypes, M2D_PlaybackError, M2D_PlaybackUtils } from "./playback";
	import { M2D_EYTAPIErrorSubtypes, M2D_YTAPIError, M2D_YTAPIUtils } from "./youtubeapi";
//#endregion

//#region Types
	const enum M2D_EErrorTypes {
		General = "GENERAL",
		Commands = "COMMANDS",
		Client = "CLIENT",
		Config = "CONFIG",
		Log = "LOG",
		Voice = "VOICE",
		Playback = "PLAYBACK",
		Playlist = "PLAYLIST",
		YTAPI = "YOUTUBEAPI",
		Unknown = "UNKNOWN"
	};
	type M2D_ErrorSubtypes = "UNKNOWN" |
		M2D_EGeneralErrorSubtypes |
		M2D_EConfigErrorSubtypes |
		M2D_ELogErrorSubtypes |
		M2D_EClientErrorSubtypes |
		M2D_ECommandsErrorSubtypes |
		M2D_EVoiceErrorSubtypes |
		M2D_EPlaylistErrorSubtypes |
		M2D_EPlaybackErrorSubtypes |
		M2D_EYTAPIErrorSubtypes;
	interface M2D_IError {
		type: M2D_EErrorTypes;
		subtype: M2D_ErrorSubtypes;
		data: Record<string, any>;
	};
	type M2D_Error = M2D_IUnknownError |
		M2D_GeneralError |
		M2D_ConfigError |
		M2D_ClientError |
		M2D_LogError |
		M2D_CommandsError |
		M2D_VoiceError |
		M2D_PlaylistError |
		M2D_PlaybackError |
		M2D_YTAPIError;

	//#region Error types
		const enum M2D_EGeneralErrorSubtypes {
			NoEnvVariable = "NO_ENV_VARIABLE",
			DevModeUserNotAllowed = "DEV_MODE_USER_NOT_ALLOWED"
		};
		interface M2D_IUnknownError extends M2D_IError {
			data: {
				errorData: unknown;
			}
		};
		interface M2D_IGeneralNoEnvVariableError extends M2D_IError {
			data: {
				envVariable: string;
			};
		};
		interface M2D_IGeneralDevModeUserNotAllowedError extends M2D_IError {
			data: {
				userId: string;
			}
		};

		type M2D_GeneralError = M2D_IGeneralNoEnvVariableError |
			M2D_IGeneralDevModeUserNotAllowedError;
	//#endregion

	type M2D_EmbedType = "info" | "success" | "error";
	interface M2D_IEmbedOptions {
		title?: string;
		description: string;
		type: M2D_EmbedType;
		imageURL?: string;
		thumbnailURL?: string;
		fields?: EmbedField[];
	}
//#endregion

dotenvConfig();

const M2D_DEV_ALLOWED_USERS: string[] = [];

const M2D_GeneralUtils = {
	getMuzyk2DVersion: () => M2DVersion,
	getEnvVar: (envVar: string) => new Promise<string>((res, rej) => {
		if(process.env[`M2D_${envVar}`]) {
			res(process.env[`M2D_${envVar}`] as string);
		} else rej({
			type: M2D_EErrorTypes.General,
			subtype: M2D_EGeneralErrorSubtypes.NoEnvVariable,
			data: {
				envVariable: envVar
			}
		} as M2D_IGeneralNoEnvVariableError);
	}),
	isDevModeEnabled: () => new Promise<boolean>((res, rej) => {
		M2D_GeneralUtils.getEnvVar("DEV_MODE")
			.then((val) => {
				if(val === "true") res(true);
				else res(false);
			})
			.catch(() => res(false));
	}),
	embedBuilder: (options: M2D_IEmbedOptions): MessageEmbed => {
		const embed = new MessageEmbed();

		switch(options.type) {
			case "error":
				embed.setColor("#C80000");
			break;
			case "info":
				embed.setColor("#0095CD");
			break;
			case "success":
				embed.setColor("#00C800");
			break;
		}

		if(options.title) embed.setTitle(options.title);
		if(options.fields) embed.setFields(...options.fields);
		if(options.imageURL) embed.setImage(options.imageURL);
		if(options.thumbnailURL) embed.setThumbnail(options.thumbnailURL);

		embed.setDescription(options.description);
		embed.setTimestamp(new Date());
		embed.setFooter(`Muzyk2D - v${M2D_GeneralUtils.getMuzyk2DVersion()}`);
		
		return embed;
	},
	exitHandler: (exitCode: number) => {
		M2D_LogUtils.logMessage("info", "Trwa wyłączanie Muzyka2D...")
			.then(() => M2D_ConfigUtils.configExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_LogUtils.logExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_PlaylistUtils.playlistExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_PlaybackUtils.playbackExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_VoiceUtils.voiceExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => M2D_YTAPIUtils.YTAPIExitHandler()
				.catch((err: M2D_Error) => console.error(`"${M2D_GeneralUtils.getErrorString(err)}" - "${JSON.stringify(err.data)}"`))
			)
			.then(() => process.exit(exitCode));
	},
	getErrorString: (error: M2D_Error): string => {
		if(error.type !== M2D_EErrorTypes.Unknown) {
			return `${error.type}_${error.subtype}`;
		} else return `UNKNOWN`;
	},
	delay: (ms: number) => new Promise<void>((res, rej) => setTimeout(res, ms)),
	loadDevModeAllowedUsers: () => new Promise<void>((res, rej) => {
		M2D_GeneralUtils.isDevModeEnabled()
			.then((isEnabled) => {
				if(isEnabled) {
					return M2D_GeneralUtils.getEnvVar("DEV_ALLOWED_USERS")
						.then((val: string) => {
							if(val.includes(" ")) {
								const allowedUsers = val.split(" ");

								M2D_DEV_ALLOWED_USERS.push(...allowedUsers);
							} else {
								M2D_DEV_ALLOWED_USERS.push(val);
							}
							res();
						});
				} else res();
			})
			.catch((err) => rej(err));
	}),
	isUserDevModeAllowed: (userId: string) => M2D_DEV_ALLOWED_USERS.find((v) => v === userId) !== undefined,
	initGeneralCapabilities: () => new Promise<void>((res, rej) => {
		console.log(`Inicjalizowanie ogólnych możliwości...`);
		M2D_GeneralUtils.loadDevModeAllowedUsers()
			.then(() => {
				console.log(`Zainicjalizowano ogólne możliwości!`);
				res();
			})
			.catch((err) => rej(err));
	})
};


//#region Exports
export type {
	M2D_IError,
	M2D_IGeneralNoEnvVariableError,
	M2D_IGeneralDevModeUserNotAllowedError,
	M2D_IEmbedOptions,
	M2D_EmbedType,
	M2D_IUnknownError,
	M2D_Error
};
export {
	M2D_EErrorTypes,
	M2D_ErrorSubtypes,
	M2D_EGeneralErrorSubtypes,
	M2D_GeneralUtils
};
//#endregion