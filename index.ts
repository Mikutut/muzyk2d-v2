//#region Imports
	import { M2D_ClientUtils } from "./client";
	import { M2D_LogUtils } from "./log";
	import { M2D_GeneralUtils, M2D_Error } from "./utils";
//#endregion

M2D_ClientUtils.initEventHandlers();

M2D_GeneralUtils.getEnvVar("DISCORD_ACCESS_TOKEN")
	.then((val) => M2D_ClientUtils.loginClient(val))
	.catch((err: M2D_Error) => {
		M2D_LogUtils.logMultipleMessages(`error`, [`Wystąpił błąd podczas uwierzytelniania z serwerami Discorda!`, `Oznaczenie błędu: ${M2D_GeneralUtils.getErrorString(err)}`, `Informacje o błędzie: "${JSON.stringify(err.data)}"`, `Muzyk2D przejdzie do samowyłączenia...`])
			.then(() => M2D_GeneralUtils.exitHandler(1));
	});

// SIGTERM/SIGINT handlers
process.on("SIGTERM", () => M2D_GeneralUtils.exitHandler(0));
process.on("SIGINT", () => M2D_GeneralUtils.exitHandler(0));