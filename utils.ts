//#region Imports
	import { version as M2DVersion } from "./package.json";
	import { config as dotenvConfig } from "dotenv";
	import { EmbedField, MessageEmbed } from "discord.js";
	import { M2D_EConfigErrorSubtypes } from "./config";
	import { M2D_ELogErrorSubtypes, M2D_LogUtils } from "./log";
import { M2D_EClientErrorSubtypes } from "./client";
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
		YouTubeAPI = "YOUTUBEAPI",
		Unknown = "UNKNOWN"
	};
	type M2D_ErrorSubtypes = "UNKNOWN" | M2D_EGeneralErrorSubtypes | M2D_EConfigErrorSubtypes | M2D_ELogErrorSubtypes | M2D_EClientErrorSubtypes;
	interface M2D_IError {
		type: M2D_EErrorTypes;
		subtype: M2D_ErrorSubtypes;
		data: Record<string, any>;
	};

	//#region Error types
		const enum M2D_EGeneralErrorSubtypes {
			NoEnvVariable = "NO_ENV_VARIABLE"
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
		M2D_LogUtils.logMessage("info", "Rozpoczęto proces wyłączania...")
			.then(() => M2D_LogUtils.logMessage("success", "Zakończono proces wyłączania!"))
			.then(() => process.exit(exitCode));
	}
};


//#region Exports
export type {
	M2D_IError,
	M2D_IGeneralNoEnvVariableError,
	M2D_IEmbedOptions,
	M2D_EmbedType,
	M2D_IUnknownError
};
export {
	M2D_EErrorTypes,
	M2D_ErrorSubtypes,
	M2D_EGeneralErrorSubtypes,
	M2D_GeneralUtils
};
//#endregion