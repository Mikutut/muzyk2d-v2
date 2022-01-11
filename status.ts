//#region Imports
	import { M2D_LogUtils } from "./log";
	import { M2D_ClientUtils } from "./client";
	import { M2D_Error, M2D_IError, M2D_GeneralUtils, M2D_EErrorTypes } from "./utils";
	import { PresenceData, PresenceStatusData, PresenceStatus, ClientUser, Client } from "discord.js";
//#endregion

//#region Types
	//#region Error types
		const enum M2D_EStatusErrorSubtypes {
			ClientUserNull = "CLIENT_USER_NULL"
		};
		interface M2D_IStatusClientUserNullError extends M2D_IError {
			data: Record<string, never>;
		};

		type M2D_StatusError = M2D_IStatusClientUserNullError;
	//#endregion
//#endregion

let presenceData: PresenceData;

const M2D_StatusUtils = {
	updateStatusMessage: () => new Promise<void>((res, rej) => {
		presenceData = {
			status: "online",
			afk: false,
			activities: [
				{
					name: `Muzyk2D v${M2D_GeneralUtils.getMuzyk2DVersion()} | obecny na ${M2D_ClientUtils.getClient().guilds.cache.size.toString()} serwerach`,
					type: "PLAYING",
					url: "https://github.com/Mikutut/muzyk2d-v2"
				}
			]
		};

		if(M2D_ClientUtils.getClient().user !== null) {
			(M2D_ClientUtils.getClient().user as ClientUser).setPresence(presenceData);
			res();
		} else rej({
			type: M2D_EErrorTypes.Status,
			subtype: M2D_EStatusErrorSubtypes.ClientUserNull,
			data: {}
		} as M2D_IStatusClientUserNullError);
	}),
	initStatusCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie statusu...`)
			.then(() => M2D_StatusUtils.updateStatusMessage())
			.then(() => { 
				if(M2D_ClientUtils.getClient().user !== null) {
					(M2D_ClientUtils.getClient().user as ClientUser).setPresence(presenceData);
				} else Promise.reject({
					type: M2D_EErrorTypes.Status,
					subtype: M2D_EStatusErrorSubtypes.ClientUserNull,
					data: {}
				} as M2D_IStatusClientUserNullError);
			})
			.then(() => M2D_LogUtils.logMessage(`success`, `Zainicjalizowano status!`))
			.then(() => res())
			.catch((err) => rej(err));
	}),
	statusExitHandler: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Wyłączanie statusu...`)
			.then(() => M2D_LogUtils.logMessage(`success`, `Wyłączono status!`))
			.then(() => res());
	})
};

//#region Exports
	export type {
		M2D_IStatusClientUserNullError,
		M2D_StatusError
	};
	export {
		M2D_EStatusErrorSubtypes,
		M2D_StatusUtils
	};
//#endregion