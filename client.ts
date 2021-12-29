//#region Imports
	import { M2D_ConfigUtils } from "./config";
import { Client, Guild, Channel, GuildMember, User, Intents } from "discord.js";
import { M2D_LogUtils } from "./log";
import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IError } from "./utils";
//#endregion

//#region Types
	//#region Error types
		const enum M2D_EClientErrorSubtypes {
			DiscordAPI = "DISCORD_API"
		};
		interface M2D_IClientDiscordAPIError extends M2D_IError {
			data: {
				errorMessage: string;
			}
		};
	//#endregion
//#endregion

const M2D_Client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_VOICE_STATES,
		Intents.FLAGS.GUILD_MESSAGE_TYPING,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_VOICE_STATES
	]
});

const M2D_ClientUtils = {
	getClient: () => M2D_Client,
	loginClient: (token: string) => new Promise<void>((res, rej) => {
		M2D_Client.login(token)
			.then(() => res())
			.catch((err) => rej({
				type: M2D_EErrorTypes.Client,
				subtype: M2D_EClientErrorSubtypes.DiscordAPI,
				data: {
					errorMessage: err.message
				}
			} as M2D_IClientDiscordAPIError));
	}),
	initEventHandlers: () => {
		M2D_Client.on("ready", () => {
			console.log(`Rozpoczęto wstępną inicjalizację...`);
			M2D_LogUtils.initLogCapabilities()
				.then(() => M2D_ConfigUtils.initConfigCapabilities())
				.then(() => {
					M2D_LogUtils.logMessage("success", `Muzyk2D (v${M2D_GeneralUtils.getMuzyk2DVersion()}) - gotowy do działania!`);
				})
				.catch((err) => {
					M2D_LogUtils.logMultipleMessages("error", `Wystąpił błąd podczas wstępnej inicjalizacji!`, `Typ błędu: "${err.type}"`, `Podtyp błędu: "${err.subtype}"`, `Informacje o błędzie: "${JSON.stringify(err.data, null, 4)}"`, `Muzyk2D przejdzie do samowyłączenia.`)
						.then(() => M2D_GeneralUtils.exitHandler(1));
				})
		});
	}
};

//#region Exports
	export type {
		M2D_IClientDiscordAPIError
	};
	export {
		M2D_EClientErrorSubtypes,
		M2D_ClientUtils
	};
//#endregion