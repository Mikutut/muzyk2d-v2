//#region Imports
	import { version as M2DVersion } from "./package.json";
	import { config as dotenvConfig } from "dotenv";
	import { EmbedField, MessageEmbed } from "discord.js";
	import { M2D_ConfigUtils, M2D_EConfigErrorSubtypes, 
		M2D_IConfigFilesystemError, 
		M2D_IConfigMissingKeyError, 
		M2D_IConfigMissingLabelError,
		M2D_IConfigKeyNotOverridableError,
		M2D_IConfigConfigSchemeMismatchError } from "./config";
	import { M2D_ELogErrorSubtypes, M2D_LogUtils, 
		M2D_ILogFilesystemError } from "./log";
	import { M2D_EClientErrorSubtypes, 
		M2D_IClientDiscordAPIError,
		M2D_IClientMessageInvalidError } from "./client";
	import { M2D_CommandUtils, M2D_ECommandsErrorSubtypes, 
		M2D_ICommandsMissingCommandError, 
		M2D_ICommandsInsufficientParametersError, 
		M2D_ICommandsMissingSuppParametersError, 
		M2D_ICommandsMissingAliasError, 
		M2D_ICommandsMissingCategoryError, 
		M2D_ICommandsMissingParameterError,
		M2D_ICommandsCommandDeveloperOnlyError, 
		M2D_ICommandsCommandNotInvokableInChatError,
		M2D_ICommandsNoCommandsInCategoryError,
		M2D_ICommandsCommandNotActiveError,
		M2D_ICommandsDuplicateAliasesError } from "./commands";
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
	type M2D_ErrorSubtypes = "UNKNOWN" |
		M2D_EGeneralErrorSubtypes |
		M2D_EConfigErrorSubtypes |
		M2D_ELogErrorSubtypes |
		M2D_EClientErrorSubtypes |
		M2D_ECommandsErrorSubtypes;
	interface M2D_IError {
		type: M2D_EErrorTypes;
		subtype: M2D_ErrorSubtypes;
		data: Record<string, any>;
	};
	type M2D_Error = M2D_IUnknownError |
		M2D_IGeneralNoEnvVariableError |
		M2D_IConfigFilesystemError |
		M2D_IConfigMissingKeyError |
		M2D_IConfigMissingLabelError |
		M2D_IConfigKeyNotOverridableError |
		M2D_IConfigConfigSchemeMismatchError |
		M2D_IClientDiscordAPIError |
		M2D_IClientMessageInvalidError |
		M2D_ILogFilesystemError |
		M2D_ICommandsMissingCommandError |
		M2D_ICommandsInsufficientParametersError |
		M2D_ICommandsMissingSuppParametersError |
		M2D_ICommandsMissingAliasError |
		M2D_ICommandsMissingCategoryError |
		M2D_ICommandsMissingParameterError | 
		M2D_ICommandsCommandDeveloperOnlyError |
		M2D_ICommandsCommandNotInvokableInChatError |
		M2D_ICommandsNoCommandsInCategoryError |
		M2D_ICommandsCommandNotActiveError |
		M2D_ICommandsDuplicateAliasesError;

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
			.then(() => M2D_LogUtils.logMessage("info", `Zapisywanie konfiguracji do pliku...`)
				.then(() => M2D_ConfigUtils.saveConfigToFile())
				.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas zapisywania konfiguracji do pliku!`, `Typ błędu: "${err.type}"`, `Podtyp błędu: "${err.subtype}"`, `Dane o błędzie: "${JSON.stringify(err.data, null, 4)}"`))
			)
			.then(() => M2D_LogUtils.leaveTrailingNewline()
				.catch(() => {return;})
			)
			.then(() => process.exit(exitCode));
	},
	getErrorString: (error: M2D_Error): string => {
		if(error.type !== M2D_EErrorTypes.Unknown) {
			return `${error.type}_${error.subtype}`;
		} else return `UNKNOWN`;
	}
};


//#region Exports
export type {
	M2D_IError,
	M2D_IGeneralNoEnvVariableError,
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