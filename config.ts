//#region Imports
	import { M2D_LogUtils } from "./log";
	import { M2D_GeneralUtils, M2D_IGeneralNoEnvVariableError, M2D_IError, M2D_EErrorTypes, M2D_Error } from "./utils";
	import * as fs from "fs/promises";
//#endregion

//#region Types
	interface M2D_IConfigGuildEntry {
		guildId: string;
		value: string;
	};
	interface M2D_IConfigSchemeEntry {
		name: string;
		label: string;
		description: string;
		overridable: boolean;
		overrideOnly: boolean;
	}
	interface M2D_IConfigEntry {
		name: string;
		value: string;
		guildOverrides: M2D_IConfigGuildEntry[];
	}
	//#region Error types
		const enum M2D_EConfigErrorSubtypes {
			Filesystem = "FILESYSTEM",
			MissingKey = "MISSING_KEY",
			MissingLabel = "MISSING_LABEL",
			KeyNotOverridable = "KEY_NOT_OVERRIDABLE",
			KeyOverrideOnly = "KEY_OVERRIDE_ONLY",
			OverrideNotPresent = "OVERRIDE_NOT_PRESENT",
			ConfigSchemeMismatch = "CONFIG_SCHEME_MISMATCH",
			NoDefaultConfig = "NO_DEFAULT_CONFIG"
		};
		interface M2D_IConfigFilesystemError extends M2D_IError {
			data: {
				errorMessage: string;
				path: string;
			}
		};
		interface M2D_IConfigMissingKeyError extends M2D_IError {
			data: {
				key: string;
			}
		};
		interface M2D_IConfigMissingLabelError extends M2D_IError {
			data: {
				label: string;
			}
		};
		interface M2D_IConfigKeyNotOverridableError extends M2D_IError {
			data: {
				key: string;
			}
		};
		interface M2D_IConfigOverrideNotPresentError extends M2D_IError {
			data: {
				key: string;
				guildId: string;
			}
		};
		interface M2D_IConfigKeyOverrideOnlyError extends M2D_IError {
			data: {
				key: string;
			}
		};
		interface M2D_IConfigConfigSchemeMismatchError extends M2D_IError {
			data: {
				excessiveKeys: string[];
				missingKeys: string[]
			};
		};
		interface M2D_IConfigNoDefaultConfigError extends M2D_IError {
			data: Record<string, never>;
		}

		type M2D_ConfigError = M2D_IConfigFilesystemError |
			M2D_IConfigMissingKeyError |
			M2D_IConfigMissingLabelError |
			M2D_IConfigKeyNotOverridableError |
			M2D_IConfigConfigSchemeMismatchError |
			M2D_IConfigNoDefaultConfigError;
	//#endregion
//#endregion

//#region Variables
	let M2D_ConfigFileLocation = "m2d_config.json";
	let M2D_CONFIG_SCHEME: M2D_IConfigSchemeEntry[] = [];
	let M2D_CONFIG: M2D_IConfigEntry[] = [];
	let M2D_DEFAULT_CONFIG: M2D_IConfigEntry[] = [];
//#endregion

const M2D_ConfigUtils = {
	isConfigValueSet: (key: string) => new Promise<boolean>((res, rej) => {
		M2D_ConfigUtils.getConfigValue(key)
			.then((val) => res(val.length > 0))
			.catch((err) => rej(err));
	}),
	isConfigValueOverrideSet: (guildId: string, key: string) => new Promise<boolean>((res, rej) => {
		M2D_ConfigUtils.getConfigOverrideValue(guildId, key)
			.then((val) => res(val.length > 0))
			.catch((err) => rej(err));	
	}),
	isConfigEntryInScheme: (keyorlabel: string): boolean => M2D_CONFIG_SCHEME.filter((v) => v.name === keyorlabel || v.label === keyorlabel).length > 0,
	getConfigValue: (key: string, guildId?: string) => new Promise<string>((res, rej) => {
		if(guildId) {
			M2D_ConfigUtils.getConfigOverrideValue(guildId, key)
				.then((val) => res(val))
				.catch((err) => {
					if(err.subtype === M2D_EConfigErrorSubtypes.MissingKey) {
						rej(err as M2D_IConfigMissingKeyError);
					} else return M2D_ConfigUtils.getGlobalConfigValue(key)
						.then((val) => res(val))
						.catch((err) => rej(err));
				});
		} else {
			M2D_ConfigUtils.getGlobalConfigValue(key)
				.then((val) => res(val))
				.catch((err) => rej(err));
		}
	}),
	setConfigOverride: (guildId: string, key: string, value: string) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości zastępującej dla wartości konfiguracyjnej o kluczu "${key}" na serwerze o ID "${guildId}"...`)

		let cKey = key;
		if(M2D_ConfigUtils.isConfigEntryInScheme(cKey)) {
			M2D_ConfigUtils.getConfigEntryKeyFromLabel(cKey)
				.then((_key) => {cKey = _key})
				.catch(() => {return;})
				.then(() => M2D_LogUtils.logMessage("info", `Znaleziono wartość konfiguracyjną o kluczu "${cKey}"! Szukanie wartości zastępującej...`)
					.then(() => {
						const configEntry = M2D_CONFIG.find((v) => v.name === cKey) as M2D_IConfigEntry;
						M2D_ConfigUtils.getConfigSchemeEntry(cKey)
							.then((schemeEntry: M2D_IConfigSchemeEntry) => {
								if(schemeEntry.overridable) {
									const configGuildOverrideEntry: M2D_IConfigGuildEntry | undefined = configEntry.guildOverrides.find((v) => v.guildId === guildId);

									if(configGuildOverrideEntry) {
										const cEIDX = M2D_CONFIG.indexOf(configEntry);
										const cGOIDX = configEntry.guildOverrides.indexOf(configGuildOverrideEntry);

										M2D_CONFIG[cEIDX].guildOverrides[cGOIDX].value = value;
										M2D_LogUtils.logMessage(`success`, `Pomyślnie zmieniono wartość wartości zastępującej wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}" na "${value}"!`)
											.then(() => res());
									} else {
										const cEIDX = M2D_CONFIG.indexOf(configEntry);

										M2D_CONFIG[cEIDX].guildOverrides.push({
											guildId,
											value
										});
										M2D_LogUtils.logMessage(`success`, `Pomyślnie zmieniono wartość wartości zastępującej wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}" na "${value}"!`)
											.then(() => res());
									}
								} else M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${cKey}" jest niezastępywalna!`)
									.then(() => rej({
										type: M2D_EErrorTypes.Config,
										subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
										data: {
											key
										}
									} as M2D_IConfigKeyNotOverridableError));
							})
							.catch(() => {return;})
					})
				);
		} else M2D_LogUtils.logMessage("error", `Próbowano uzyskać dostęp do wartości konfiguracyjnej o kluczu "${cKey}", lecz wartość taka nie istnieje!`)
		.then(() => 
			rej({
				type: M2D_EErrorTypes.Config,
				subtype: M2D_EConfigErrorSubtypes.MissingKey,
				data: {
					key
				}
			} as M2D_IConfigMissingKeyError)
		); 
	}),
	getGlobalConfigValue: (key: string) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości konfiguracyjnej o kluczu "${key}"...`)
		if(M2D_ConfigUtils.isConfigEntryInScheme(key)) {
			let cKey: string = key;
			M2D_ConfigUtils.getConfigEntryKeyFromLabel(cKey)
				.then((_key) => { cKey = _key })
				.catch(() => {return;})
				.then(() => {
					const configEntry = M2D_CONFIG.find((v) => v.name === cKey) as M2D_IConfigEntry;

					M2D_LogUtils.logMessage("success", `Znaleziono wartość konfiguracyjną o kluczu "${key}"!`)
						.then(() => {
							M2D_ConfigUtils.getConfigSchemeEntry(cKey)
								.then((schemeEntry: M2D_IConfigSchemeEntry) => {
									if(!schemeEntry.overrideOnly) {
										res(configEntry.value);
									} else {
										M2D_LogUtils.logMessage("error", `Próbowano odczytać wartość konfiguracyjną o kluczu "${key}", lecz wartość ta jest tylko zastępowywalna!`)
											.then(() => rej({
												type: M2D_EErrorTypes.Config,
												subtype: M2D_EConfigErrorSubtypes.KeyOverrideOnly,
												data: {
													key
												}
											} as M2D_IConfigKeyOverrideOnlyError));
									}
								})
								.catch(() => {return;});	
						});
				});
		} else M2D_LogUtils.logMessage(`error`, `Próbowano odczytać wartość konfiguracyjną nienależącą do schematu: "${key}"`)
			.then(() => rej({
				type: M2D_EErrorTypes.Config,
				subtype: M2D_EConfigErrorSubtypes.MissingKey,
				data: {
					key
				}
			} as M2D_IConfigMissingKeyError));
	}),
	getConfigOverrideValue: (guildId: string, key: string) => new Promise<string>((res, rej) => {
		M2D_LogUtils.logMessage("info", `Rozpoczęto proces wyszukiwania wartości zastępującej dla wartości konfiguracyjnej o kluczu "${key}" na serwerze o ID "${guildId}"...`)

		if(M2D_ConfigUtils.isConfigEntryInScheme(key)) {
			let cKey: string = key;
			M2D_ConfigUtils.getConfigEntryKeyFromLabel(cKey)
				.then((_key) => { cKey = _key })
				.catch(() => {return;})
				.then(() => {
					const configEntry = M2D_CONFIG.find((v) => v.name === cKey) as M2D_IConfigEntry;
					M2D_LogUtils.logMessage("info", `Znaleziono wartość konfiguracyjną o kluczu "${key}"! Szukanie wartości zastępującej...`)
						.then(() => M2D_ConfigUtils.getConfigSchemeEntry(cKey)
							.then((schemeEntry: M2D_IConfigSchemeEntry) => {
								if(schemeEntry.overridable) {
									const configGuildOverrideEntry: M2D_IConfigGuildEntry | undefined = configEntry.guildOverrides.find((v) => v.guildId === guildId);

									if(configGuildOverrideEntry) {
										M2D_LogUtils.logMessage("success", `Znaleziono wartość zastępującą wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}"!`)
											.then(() => res(configGuildOverrideEntry.value));
									} else {
										M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" nie posiada wartości zastępującej dla serwera o ID "${guildId}"!`)
											.then(() => rej({
												type: M2D_EErrorTypes.Config,
												subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
												data: {
													key,
													guildId
												}
											} as M2D_IConfigOverrideNotPresentError));
									}
								} else {
									M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" jest niezastępywalna!`)
										.then(() => rej({
											type: M2D_EErrorTypes.Config,
											subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
											data: {
												key
											}
										} as M2D_IConfigKeyNotOverridableError));
								}
							})
							.catch(() => {return;})
						);
				});	
		} else M2D_LogUtils.logMessage(`error`, `Próbowano odczytać wartość konfiguracyjną nienależącą do schematu: "${key}"`)
			.then(() => rej({
				type: M2D_EErrorTypes.Config,
				subtype: M2D_EConfigErrorSubtypes.MissingKey,
				data: {
					key
				}
			} as M2D_IConfigMissingKeyError));

		// const configEntry: M2D_IConfigEntry | undefined = M2D_CONFIG.find((v) => v.name === key || v.label === key);

		// if(configEntry) {
		// 	M2D_LogUtils.logMessage("info", `Znaleziono wartość konfiguracyjną o kluczu "${key}"! Szukanie wartości zastępującej...`)
		// 		.then(() => {
		// 			if(configEntry.overridable) {
		// 				const configGuildOverrideEntry: M2D_IConfigGuildEntry | undefined = configEntry.guildOverrides.find((v) => v.guildId === guildId);

		// 				if(configGuildOverrideEntry) {
		// 					M2D_LogUtils.logMessage("success", `Znaleziono wartość zastępującą wartość konfiguracyjną o kluczu "${key}" dla serwera o ID "${guildId}"!`)
		// 						.then(() => res(configGuildOverrideEntry.value));
		// 				} else {
		// 					M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" nie posiada wartości zastępującej dla serwera o ID "${guildId}"!`)
		// 						.then(() => rej({
		// 							type: M2D_EErrorTypes.Config,
		// 							subtype: M2D_EConfigErrorSubtypes.OverrideNotPresent,
		// 							data: {
		// 								key,
		// 								guildId
		// 							}
		// 						} as M2D_IConfigOverrideNotPresentError));
		// 				}
		// 			} else {
		// 				M2D_LogUtils.logMessage("error", `Wartość konfiguracyjna o kluczu "${key}" jest niezastępywalna!`)
		// 					.then(() => rej({
		// 						type: M2D_EErrorTypes.Config,
		// 						subtype: M2D_EConfigErrorSubtypes.KeyNotOverridable,
		// 						data: {
		// 							key
		// 						}
		// 					} as M2D_IConfigKeyNotOverridableError));
		// 			}
		// 		});
		// } else { 
		// 	M2D_LogUtils.logMessage("error", `Próbowano uzyskać dostęp do wartości konfiguracyjnej o kluczu "${key}", lecz wartość taka nie istnieje!`)
		// 		.then(() => 
		// 			rej({
		// 				type: M2D_EErrorTypes.Config,
		// 				subtype: M2D_EConfigErrorSubtypes.MissingKey,
		// 				data: {
		// 					key
		// 				}
		// 			} as M2D_IConfigMissingKeyError)
		// 		);
		// }
	}),
	getConfigEntryKeyFromLabel: (label: string) => new Promise<string>((res, rej) => {
		if(M2D_ConfigUtils.isConfigEntryInScheme(label)) {
			res((M2D_CONFIG_SCHEME.find((v) => v.label === label) as M2D_IConfigSchemeEntry).name);
		} else rej({
			type: M2D_EErrorTypes.Config,
			subtype: M2D_EConfigErrorSubtypes.MissingLabel,
			data: {
				label
			}
		} as M2D_IConfigMissingLabelError);
	}),
	getConfigEntryLabelFromKey: (key: string) => new Promise<string>((res, rej) => {
		if(M2D_ConfigUtils.isConfigEntryInScheme(key)) {
			res((M2D_CONFIG_SCHEME.find((v) => v.name === key) as M2D_IConfigSchemeEntry).label);
		} else rej({
			type: M2D_EErrorTypes.Config,
			subtype: M2D_EConfigErrorSubtypes.MissingKey,
			data: {
				key
			}
		} as M2D_IConfigMissingKeyError);
	}),
	getConfigSchemeEntry: (key: string) => new Promise<M2D_IConfigSchemeEntry>((res, rej) => {
		if(M2D_ConfigUtils.isConfigEntryInScheme(key)) {
			res(M2D_CONFIG_SCHEME.find((v) => v.name === key) as M2D_IConfigSchemeEntry);
		} else rej({
			type: M2D_EErrorTypes.Config,
			subtype: M2D_EConfigErrorSubtypes.MissingKey,
			data: {
				key
			}
		} as M2D_IConfigMissingKeyError);
	}),
	readConfigFile: () => new Promise<void>((res, rej) => {
				fs.readFile(M2D_ConfigFileLocation, {
					encoding: "utf-8",
					flag: "r"
				})
					.then((data: string) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano plik konfiguracyjny!")
						.then(() => {
							const newConfig: M2D_IConfigEntry[] = JSON.parse(data);
							M2D_ConfigUtils.validateConfig(newConfig)
								.then(() => { 
									M2D_CONFIG = newConfig;
									res();
								})
								.catch((err: M2D_IConfigConfigSchemeMismatchError) => {
									if(err.data.excessiveKeys.length === 0) {
										if(err.data.missingKeys.length > 0) {
											if(M2D_DEFAULT_CONFIG.length > 0) {
												for(const cse of M2D_CONFIG_SCHEME) {
													if(!(newConfig.find((v) => v.name === cse.name))) {
														newConfig.push({
															name: cse.name,
															value: (M2D_DEFAULT_CONFIG.find((v) => v.name === cse.name) as M2D_IConfigEntry).value,
															guildOverrides: []
														});
													}
												}
												M2D_CONFIG = newConfig;
												res();
											} else {
												M2D_LogUtils.logMultipleMessages(`error`, `Wykryto brakujące klucze w konfiguracji, lecz nie można ich zastąpić wartościami domyślnymi. Domyślna konfiguracja nie została jeszcze wczytana!`)
													.then(() => rej({
														type: M2D_EErrorTypes.Config,
														subtype: M2D_EConfigErrorSubtypes.NoDefaultConfig,
														data: {}
													} as M2D_IConfigNoDefaultConfigError))	
											}
										} else rej(err);
									} else rej(err);
								});	
						}))
					.catch(err => M2D_LogUtils.logMessage("error", `Nie udało się wczytać konfiguracji z pliku "${M2D_ConfigFileLocation}"`)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.Filesystem,
							data: {
								errorMessage: err.message,
								path: M2D_ConfigFileLocation
							}
						} as M2D_IConfigFilesystemError))
					);
	}),
	readDefaultConfigFile: () => new Promise<void>((res, rej) => {
				fs.readFile("m2d_defaultconfig.json", {
					encoding: "utf-8",
					flag: "r"
				})
					.then((data: string) => M2D_LogUtils.logMessage("success", "Pomyślnie wczytano domyślny plik konfiguracyjny!")
						.then(() => {
							const newDefaultConfig = JSON.parse(data) as M2D_IConfigEntry[];
							M2D_ConfigUtils.validateConfig(newDefaultConfig)
								.then(() => {
									M2D_DEFAULT_CONFIG = newDefaultConfig;
									res();
								})
								.catch((err: M2D_IConfigConfigSchemeMismatchError) => rej(err));	
						}))
					.catch(err => M2D_LogUtils.logMessage("error", `Nie udało się wczytać konfiguracji z domyślnego pliku konfiguracyjnego!`)
						.then(() => rej({
							type: M2D_EErrorTypes.Config,
							subtype: M2D_EConfigErrorSubtypes.Filesystem,
							data: {
								errorMessage: err.message,
								path: "m2d_defaultconfig.json"
							}
						} as M2D_IConfigFilesystemError))
					);
	}),
	readConfigSchemeFile: () => new Promise<void>((res, rej) => {
		let M2D_ConfigSchemeFileLocation = `m2d_configscheme.json`;

		M2D_GeneralUtils.getEnvVar("CONFIG_SCHEME_FILE")
			.then((val) => M2D_LogUtils.logMessage(`info`, `Znaleziono zmienną środowiskową "M2D_CONFIG_SCHEME_FILE" - stosowanie się do jej ustawień...`)
				.then(() => { 
					M2D_ConfigSchemeFileLocation = val;
				})
			)
			.catch(() => M2D_LogUtils.logMessage(`warn`, `Nie znaleziono zmiennej środowiskowej "M2D_CONFIG_SCHEME_FILE" - stosowanie domyślnego ustawienia...`))
			.then(() => {
				fs.readFile(M2D_ConfigSchemeFileLocation, { encoding: "utf-8" })
					.then((data) => M2D_LogUtils.logMessage(`success`, `Pomyślnie wczytano schemat konfiguracji z pliku "${M2D_ConfigSchemeFileLocation}"!`)
						.then(() => {
							M2D_CONFIG_SCHEME = JSON.parse(data) as M2D_IConfigSchemeEntry[];
							res();
						})
						.catch((err) => M2D_LogUtils.logMultipleMessages(`error`, `Wystąpił błąd podczas wczytywania schematu konfiguracji z pliku "${M2D_ConfigSchemeFileLocation}".`, `Treść błędu: "${err.message}"`)
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.Filesystem,
								data: {
									errorMessage: err.message,
									path: M2D_ConfigSchemeFileLocation
								}
							} as M2D_IConfigFilesystemError))
						)
					)	
			});
	}),
	saveConfigToFile: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage("info", "Zainicjowano zapis konfiguracji do pliku...")
			.then(() => M2D_ConfigUtils.validateConfig())
			.then(() => {
				fs.writeFile(M2D_ConfigFileLocation, JSON.stringify(M2D_CONFIG), {
					encoding: "utf-8"
				})
					.then(() => {
						M2D_LogUtils.logMessage("success", `Pomyślnie zapisano konfigurację do "${M2D_ConfigFileLocation}"`)
							.then(() => res());
					})
					.catch((err) => {
						M2D_LogUtils.logMessage("error", `Nie udało się zapisać konfiguracji do "${M2D_ConfigFileLocation}"`)
							.then(() => rej({
								type: M2D_EErrorTypes.Config,
								subtype: M2D_EConfigErrorSubtypes.Filesystem,
								data: {
									errorMessage: err.message,
									path: M2D_ConfigFileLocation
								}
							} as M2D_IConfigFilesystemError));
					})
			})
			.catch((err: M2D_IConfigConfigSchemeMismatchError) => rej(err));
	}),
	validateConfig: (config?: M2D_IConfigEntry[]) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano walidację konfiguracji...`)
			.then(() => {	
				const missingKeys: string[] = [];
				const excessiveKeys: string[] = [];

				const configToCheck: M2D_IConfigEntry[] = (config) ? config : M2D_CONFIG;
				
				for(const cse of M2D_CONFIG_SCHEME) {
					if(!(configToCheck.find((v) => v.name === cse.name))) {
						missingKeys.push(cse.name);
					}
				}
				for(const ce of configToCheck) {
					if(!(M2D_CONFIG_SCHEME.find((v) => v.name === ce.name))) {
						excessiveKeys.push(ce.name);
					}
				}

				if(missingKeys.length === 0 && excessiveKeys.length === 0) {
					M2D_LogUtils.logMessage(`success`, `Walidacja zakończona. Nie wykryto żadnych odchyłów.`)
						.then(() => res());
				} else M2D_LogUtils.logMultipleMessages(`error`, `Znaleziono odchyły w konfiguracji względem schematu.`, `Brakujące klucze: "${missingKeys.join(", ")}"`, `Ponadprogramowe klucze: "${excessiveKeys.join(", ")}"`)
					.then(() => rej({
						type: M2D_EErrorTypes.Config,
						subtype: M2D_EConfigErrorSubtypes.ConfigSchemeMismatch,
						data: {
							excessiveKeys,
							missingKeys
						}
					} as M2D_IConfigConfigSchemeMismatchError));
			});
	}),
	initConfigCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie konfiguracji...`)
			.then(() => M2D_ConfigUtils.readConfigSchemeFile()
				.then(() => M2D_GeneralUtils.getEnvVar("CONFIG_FILE")
					.then((getEnvVar_retData) => M2D_LogUtils.logMessage("info", `Znaleziono zmienną środowiskową "M2D_CONFIG_FILE" - stosowanie się do jej wartości...`)
						.then(() => {
							M2D_ConfigFileLocation = getEnvVar_retData;
						})
					)
					.catch((getEnvVar_errData: M2D_IGeneralNoEnvVariableError) => M2D_LogUtils.logMessage("warn", `Nie znaleziono zmiennej środowiskowej "M2D_CONFIG_FILE" - stosowanie domyślnej wartości...`))
				)
				.then(() => M2D_GeneralUtils.getEnvVar("FORCE_READ_DEFAULT_CONFIG")
						.then((val) => val)
						.catch(() => M2D_LogUtils.logMessage(`info`, `Nie znaleziono zmiennej środowiskowej "M2D_FORCE_READ_DEFAULT_CONFIG" - pomijanie...`))
				)
				.then((val) => {
					if(val === "true") {
						M2D_LogUtils.logMessage(`info`, `Wymuszono wczytanie domyślnej konfiguracji poprzez zmienną środowiskową.`)
							.then(() => {
								M2D_ConfigUtils.readDefaultConfigFile()
									.then(() => {
										M2D_CONFIG = M2D_DEFAULT_CONFIG;
										M2D_LogUtils.logMessage(`success`, `Zainicjalizowano konfigurację!`)
											.then(() => res());
									})
									.catch((err: M2D_Error) => {
										if(M2D_GeneralUtils.getErrorString(err) === "CONFIG_CONFIG_SCHEME_MISMATCH") {
											err = err as M2D_IConfigConfigSchemeMismatchError;
											M2D_LogUtils.logMultipleMessages(`error`, `Wykryto odchylenia w domyślnej konfiguracji!`, `Muzyk2D w takim stanie nie może kontynuować pracy.`)
												.then(() => rej(err));
										} else rej(err);
									});
							});
					} else {
						M2D_ConfigUtils.readConfigFile()
							.then(() => M2D_LogUtils.logMessage(`info`, `Zainicjalizowano konfigurację!`)
									.then(() => res())
							)
							.catch(() => {
								M2D_LogUtils.logMessage(`warn`, `Nie udało się wczytać konfiguracji z pliku "${M2D_ConfigFileLocation}". Wczytywanie domyślnej konfiguracji...`)
									.then(() => {
										M2D_ConfigUtils.readDefaultConfigFile()
											.then(() => M2D_LogUtils.logMessage(`info`, `Zainicjalizowano konfigurację!`)
												.then(() => { 
													M2D_CONFIG = M2D_DEFAULT_CONFIG;
													res();
												})
											)
											.catch((err: M2D_Error) => {
												if(M2D_GeneralUtils.getErrorString(err) === "CONFIG_CONFIG_SCHEME_MISMATCH") {
													err = err as M2D_IConfigConfigSchemeMismatchError;
													M2D_LogUtils.logMultipleMessages(`error`, `Wykryto odchylenia w domyślnej konfiguracji!`, `Brakujące klucze: "${err.data.missingKeys.join(", ")}"`, `Ponadprogramowe klucze: "${err.data.excessiveKeys.join(", ")}"`, `Muzyk2D w takim stanie nie może kontynuować pracy.`)
														.then(() => rej(err));
												} else rej(err);
											});
									});
							});
					}
				})
			);
	})
};

//#region Exports
	export type {
		M2D_IConfigEntry,
		M2D_IConfigGuildEntry,
		M2D_IConfigFilesystemError,
		M2D_IConfigMissingKeyError,
		M2D_IConfigMissingLabelError,
		M2D_IConfigKeyNotOverridableError,
		M2D_IConfigConfigSchemeMismatchError,
		M2D_IConfigNoDefaultConfigError,
		M2D_ConfigError
	}
	export {
		M2D_EConfigErrorSubtypes,
		M2D_ConfigUtils
	}
//#endregion