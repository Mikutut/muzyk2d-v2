//#region Imports
	import { M2D_LogUtils } from "log";
	import { M2D_GeneralUtils, M2D_IGeneralNoEnvVariableError, M2D_IError, M2D_EErrorTypes } from "utils";
	import * as fs from "fs/promises";
//#endregion

//#region Types
	interface M2D_IConfigGuildEntry {
		guildId: string;
		value: string;
	};
	interface M2D_IConfigEntry {
		name: string;
		value: string;
		overridable: boolean;
		guildOverrides: M2D_IConfigGuildEntry[];
	}
	//#region Error types
		const enum M2D_EConfigErrorSubtypes {
			Filesystem = "FILESYSTEM"
		};
		interface M2D_IConfigFilesystemError extends M2D_IError {
			data: {
				errorMessage: string;
				path: string;
			}
		};
	//#endregion
//#endregion

//#region Variables
	let M2D_ConfigFileLocation = "m2d_config.json";
	let M2D_CONFIG: M2D_IConfigEntry[] = [];
//#endregion

const M2D_ConfigUtils = {
	initConfigCapabilities: () => new Promise<void>((res, rej) => {
		M2D_GeneralUtils.getEnvVar("CONFIG_FILE")
			.then((getEnvVar_retData) => M2D_LogUtils.logMessage("info", `Znaleziono zmienną środowiskową "M2D_CONFIG_FILE" - stosowanie się do jej wartości...`)
				.then(() => {
					M2D_ConfigFileLocation = getEnvVar_retData;
				})
			)
			.catch((getEnvVar_errData: M2D_IGeneralNoEnvVariableError) => M2D_LogUtils.logMessage("warn", `Nie znaleziono zmiennej środowiskowej "M2D_CONFIG_FILE" - stosowanie domyślnej wartości...`))
			.finally(() => {
				fs.readFile(M2D_ConfigFileLocation, {
					encoding: "utf-8",
					flag: "r"
				})
					.then((data: string) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano plik konfiguracyjny!")
						.then(() => {
							M2D_CONFIG = JSON.parse(data);
							res();
						}))
					.catch(err => M2D_LogUtils.logMessage("warn", "Nie udało się wczytać pliku konfiguracyjnego - wczytywanie domyślnej konfiguracji...")
						.then(() => {
							fs.readFile("m2d_defaultconfig.json", {
								encoding: "utf-8",
								flag: "r"
							})
								.then((data) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano domyślną konfigurację!")
									.then(() => {
										M2D_CONFIG = JSON.parse(data);
										res();
									}))
								.catch((err) => M2D_LogUtils.logMessage("error", "Nie udało się wczytać domyślnej konfiguracji!")
									.then(() => {
										rej({
											type: M2D_EErrorTypes.Config,
											subtype: M2D_EConfigErrorSubtypes.Filesystem,
											data: {
												errorMessage: err.message,
												path: "m2d_defaultconfig.json"
											}
										} as M2D_IConfigFilesystemError);
									}));
						}));
			});
	})
};

//#region Exports
	export type {
		M2D_IConfigEntry,
		M2D_IConfigGuildEntry
	}
	export {
		M2D_EConfigErrorSubtypes,
		M2D_ConfigUtils
	}
//#endregion