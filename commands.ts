//#region Imports
	import { Message, Channel, Guild, User } from "discord.js";
	import { M2D_LogUtils } from "./log";
	import { M2D_ErrorSubtypes, M2D_IError, M2D_Error, M2D_GeneralUtils, M2D_EErrorTypes } from "./utils";
	import { nanoid } from "nanoid";
//#endregion

//#region Types
	interface M2D_ICommandCategory {
		name: string;
		label: string;
	}
	interface M2D_ICommandParameter {
		name: string;
		value: string;
	}
	interface M2D_ICommandParameterDesc {
		name: string;
		label: string;
		description: string;
		required: boolean;
	}
	interface M2D_ICommandSuppParameters {
		message: Message<boolean>;
		guild: Guild;
		channel: Channel;
		user: User;
	}
	type M2D_CommandHandler = (cmd: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters?: M2D_ICommandSuppParameters) => Promise<void>;
	type M2D_CommandErrorHandler = (error: M2D_Error, cmd: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters?: M2D_ICommandSuppParameters) => Promise<void>;
	interface M2D_ICommand {
		name: string;
		category: M2D_ICommandCategory;
		aliases: string[];
		parameters: M2D_ICommandParameterDesc[];
		description: string;
		active: boolean;
		developerOnly: boolean;
		chatInvokable: boolean;
		handler: M2D_CommandHandler;
		errorHandler: M2D_CommandErrorHandler;
	};
	//#region Error types
		const enum M2D_ECommandsErrorSubtypes {
			MissingAlias = "MISSING_ALIAS",
			MissingCommand = "MISSING_COMMAND",
			MissingParameter = "MISSING_PARAMETER",
			InsufficientParameters = "INSUFFICIENT_PARAMETERS",
			MissingSuppParameters = "MISSING_SUPPLEMENTARY_PARAMETERS",
			MissingCategory = "MISSING_CATEGORY",
			CommandNotActive = "COMMAND_NOT_ACTIVE",
			CommandDeveloperOnly = "COMMAND_DEVELOPER_ONLY",
			CommandNotInvokableInChat = "COMMAND_NOT_INVOKABLE_IN_CHAT",
			NoCommandsInCategory = "NO_COMMANDS_IN_CATEGORY",
			DuplicateAliases = "DUPLICATE_ALIASES"
		};
		interface M2D_ICommandsMissingCommandError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsMissingParameterError extends M2D_IError {
			data: {
				parameterName: string;
			}
		};
		interface M2D_ICommandsInsufficientParametersError extends M2D_IError {
			data: {
				commandName: string;
				requiredParametersCount: number;
				allParametersCount: number;
				receivedParametersCount: number;
			}
		};
		interface M2D_ICommandsMissingSuppParametersError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsMissingAliasError extends M2D_IError {
			data: {
				alias: string;
			}
		};
		interface M2D_ICommandsMissingCategoryError extends M2D_IError {
			data: {
				category: string;
			}
		};
		interface M2D_ICommandsCommandDeveloperOnlyError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsCommandNotInvokableInChatError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsNoCommandsInCategoryError extends M2D_IError {
			data: {
				category: M2D_ICommandCategory;
			}
		};
		interface M2D_ICommandsCommandNotActiveError extends M2D_IError {
			data: {
				commandName: string;
			}
		};
		interface M2D_ICommandsDuplicateAliasesError extends M2D_IError {
			data: {
				alias: string;
				commandNames: string[];
			}
		};

		type M2D_CommandsError = M2D_ICommandsMissingCommandError |
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
	//#endregion
//#endregion

const M2D_CATEGORIES: Record<string, M2D_ICommandCategory> = {
	general: {
		name: "general",
		label: "ogólne"
	},
	config: {
		name: "config",
		label: "konfiguracyjne"
	},
	voice: {
		name: "voice",
		label: "głosowe"
	},
	playlist: {
		name: "playlist",
		label: "playlista"
	},
	playback: {
		name: "playback",
		label: "odtwarzanie"
	}
};

const M2D_COMMANDS: M2D_ICommand[] = [
	{
		name: "pomoc",
		category: M2D_CATEGORIES.general,
		aliases: ["h", "help", "tasukete"],
		parameters: [
			{
				name: "category",
				label: "kategoria",
				description: "Kategoria komend, które chcesz wyświetlić",
				required: false
			}
		],
		description: "Wyświetla informacje dot. komend",
		active: true,
		developerOnly: false,
		chatInvokable: true,
		handler: (cmd, parameters, suppParameters) => new Promise<void>((res, rej) => {
			if(suppParameters) {
				M2D_CommandUtils.getParameterValue(parameters, "category")
					.then((val) => M2D_CommandUtils.getCategoryFromNameOrLabel(val)
						.then((cat) => M2D_CommandUtils.getCommandsByCategory(cat)
							.then((cmds) => {
								// TODO: Implement sending message
								res();
							})
							.catch((err: M2D_ICommandsNoCommandsInCategoryError) => rej(err))
						)
						.catch((err: M2D_ICommandsMissingCategoryError) => rej(err))
					)
					.catch(() => {
						// TODO: Implement sending message
						res();
					});
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingSuppParameters,
				data: {
					commandName: cmd.name
				}
			} as M2D_ICommandsMissingSuppParametersError)
		}),
		errorHandler: (error, parameters, suppParameters) => new Promise<void>((res, rej) => {
			const errString = M2D_GeneralUtils.getErrorString(error);

			switch(errString) {
				case `${M2D_EErrorTypes.Commands}_${M2D_ECommandsErrorSubtypes.MissingCategory}`: 
				{
					// TODO: Implement sending message
					res();
				}
				break;
				case `${M2D_EErrorTypes.Commands}_${M2D_ECommandsErrorSubtypes.NoCommandsInCategory}`: 
				{
					// TODO: Implement sending message
					res();
				}
				break;
				break;
				default:
					rej(error);
			}
		})
	}
];

const M2D_CommandUtils = {
	validateCommands: (commands?: M2D_ICommand[]) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano walidację komend...`)
			.then(() => {
				const checkVector: {aliases: string[]; commandName: string;}[] = [];
				const commandsToCheck: M2D_ICommand[] = (commands) ? commands : M2D_COMMANDS;

				for(const cmd of commandsToCheck) {
					if(checkVector.length === 0) {
						checkVector.push({aliases: cmd.aliases, commandName: cmd.name});
					} else {
						for(const al of cmd.aliases) {
							if(checkVector.find((v) => v.aliases.find((vv) => vv === al))) {
								const conflictingCommands = checkVector.map((v) => {
									if(v.aliases.find((vv) => vv === al)) {
										return v.commandName;
									}
								}) as string[];

								M2D_LogUtils.logMultipleMessages(`error`, [`Wykryto zduplikowane aliasy w liście komend!`, `Alias: "${al}"`, `Komendy zawierające taki alias: "${conflictingCommands.join(", ")}`])
									.then(() => rej({
										type: M2D_EErrorTypes.Commands,
										subtype: M2D_ECommandsErrorSubtypes.DuplicateAliases,
										data: {
											alias: al,
											commandNames: conflictingCommands
										}
									} as M2D_ICommandsDuplicateAliasesError));
							}
						}
					}
				}
				M2D_LogUtils.logMessage(`success`, `Walidacja komend nie wykryła żadnych odchyleń!`)
					.then(() => res());
			});	
	}),
	getParameterValue: (parameters: M2D_ICommandParameter[], name: string) => new Promise<string>((res, rej) => {
		if(parameters.find((v) => v.name === name)) {
			res((parameters.find((v) => v.name === name) as M2D_ICommandParameter).value);
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.MissingParameter,
			data: {
				parameterName: name
			}
		} as M2D_ICommandsMissingParameterError);
	}),
	getCommandFromAlias: (alias: string) => new Promise<M2D_ICommand>((res, rej) => {
		if(M2D_COMMANDS.find((v) => v.aliases.find((vv) => vv === alias))) {
			res(M2D_COMMANDS.find((v) => v.aliases.find((vv) => vv === alias)) as M2D_ICommand);
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.MissingAlias,
			data: {
				alias
			}
		} as M2D_ICommandsMissingAliasError);
	}),
	getCommand: (commandName: string) => new Promise<M2D_ICommand>((res, rej) => {
		if(M2D_COMMANDS.find((v) => v.name === commandName)) {
			res(M2D_COMMANDS.find((v) => v.name === commandName) as M2D_ICommand);
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.MissingCommand,
			data: {
				commandName
			}
		} as M2D_ICommandsMissingCommandError);
	}),
	getCategoryFromNameOrLabel: (name: string) => new Promise<M2D_ICommandCategory>((res, rej) => {
		if(M2D_CATEGORIES[name]) {
			res(M2D_CATEGORIES[name]);
		} else {
			for(const cat in M2D_CATEGORIES) {
				if(M2D_CATEGORIES[cat].label === name) res(M2D_CATEGORIES[cat]);
			}
			rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.MissingCategory,
				data: {
					category: name
				}
			} as M2D_ICommandsMissingCategoryError);
		}
	}),
	getCommandsByCategory: (category: M2D_ICommandCategory) => new Promise<M2D_ICommand[]>((res, rej) => {
		if(M2D_COMMANDS.filter((v) => v.category === category).length > 0) {
			res(M2D_COMMANDS.filter((v) => v.category === category));
		} else rej({
			type: M2D_EErrorTypes.Commands,
			subtype: M2D_ECommandsErrorSubtypes.NoCommandsInCategory,
			data: {
				category
			}
		} as M2D_ICommandsNoCommandsInCategoryError);
	}),
	buildCommandParameters: (command: M2D_ICommand, params: string[]) => new Promise<M2D_ICommandParameter[]>((res, rej) => {
		if(command.parameters.length === 0) {
			res([]);
		} else {
			const cmdRequiredParamsCount = command.parameters.filter((v) => v.required).length;
			const cmdParamsCount = command.parameters.length;
			const paramsCount = params.length;
			const outputParams: M2D_ICommandParameter[] = [];

			if(paramsCount >= cmdRequiredParamsCount && paramsCount <= cmdParamsCount) {
				for(let i = 0; i < paramsCount; i++) {
					outputParams.push({
						name: command.parameters[i].name,
						value: params[i]
					});
				}
				res(outputParams);
			} else rej({
				type: M2D_EErrorTypes.Commands,
				subtype: M2D_ECommandsErrorSubtypes.InsufficientParameters,
				data: {
					commandName: command.name,
					requiredParametersCount: cmdRequiredParamsCount,
					allParametersCount: cmdParamsCount,
					receivedParametersCount: paramsCount
				}
			} as M2D_ICommandsInsufficientParametersError)
		}
	}),
	//buildCommandHelpMessage: (command: M2D_ICommand) => new Promise<string>((res, rej) => {
//
	//}),
	invokeCommand: (command: M2D_ICommand, parameters: M2D_ICommandParameter[], suppParameters?: M2D_ICommandSuppParameters) => new Promise<void>((res, rej) => {
		const invokeId: string = nanoid(10);
		
		M2D_LogUtils.logMessage(`info`, `Wywoływanie komendy "${command.name}"... ID wywołania: "${invokeId}"`)
			.then(() => {
				if(suppParameters) M2D_LogUtils.logMessage(`info`, `IID: "${invokeId}" - Wywołanie zostało zażądane przez "${suppParameters.user.tag}".`);
				else M2D_LogUtils.logMessage(`info`, `IID: "${invokeId}" - Wywołanie zostało zażądane od wewnątrz.`);

				command.handler(command, parameters, suppParameters)
					.then(() => M2D_LogUtils.logMessage(`success`, `IID: "${invokeId}" - Pomyślnie wywołano komendę!`)
						.then(() => res())	
					)
					.catch((err: M2D_Error) => M2D_LogUtils.logMultipleMessages(`warn`, [`IID: "${invokeId}" - Wystąpił błąd przy wywoływaniu komendy.`, `IID: "${invokeId}" - Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(err)}"`, `IID: "${invokeId}" - Dane o błędzie: "${JSON.stringify(err.data)}"`, `IID: ${invokeId} - Uruchamianie obsługi błędów komendy...`])
						.then(() => command.errorHandler(err, command, parameters, suppParameters)
							.then(() => M2D_LogUtils.logMessage(`success`, `IID: "${invokeId}" - Obsługa błędów nie zgłosiła żadnych zastrzeżeń. Uznano wykonanie komendy za pomyślne.`)
								.then(() => res())
							)
							.catch((errerr) => M2D_LogUtils.logMultipleMessages(`error`, [`IID: "${invokeId}" - Obsługa błędów zgłosiła następujący błąd:`, `IID: "${invokeId}" - Oznaczenie błędu: "${M2D_GeneralUtils.getErrorString(errerr)}"`, `IID: "${invokeId}" - Dane o błędzie: "${JSON.stringify(err.data)}"`, `IID: "${invokeId}" - Przekazywanie błędu dalej...`])
								.then(() => rej(errerr))
							)
						)
					)
			})	
	}),
	addCommands: (commands: M2D_ICommand[]) => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Zainicjowano operację dodania nowych komend...`)
			.then(() => {
				const cmds: M2D_ICommand[] = [...M2D_COMMANDS, ...commands];
				
				M2D_CommandUtils.validateCommands(cmds)
					.then(() => {
						M2D_COMMANDS.push(...commands);
						M2D_LogUtils.logMessage(`success`, `Operacja dodania nowych komend zakończyła się sukcesem!`)
							.then(() => res());
					})
					.catch((err) => M2D_LogUtils.logMessage(`error`, `Wystąpił błąd podczas dodawania nowych komend. Nowe komendy nie zostały dodane.`)
						.then(() => rej(err))
					);
			});	
	}),
	initCommandCapabilities: () => new Promise<void>((res, rej) => {
		M2D_LogUtils.logMessage(`info`, `Inicjalizowanie komend...`)
			.then(() => M2D_CommandUtils.validateCommands())
			.then(() => {
				M2D_LogUtils.logMessage(`success`, `Zainicjalizowano komendy!`)
					.then(() => res());
			})
			.catch((err: M2D_Error) => rej(err));
	})
};

//#region Exports
	export type {
		M2D_ICommand,
		M2D_ICommandCategory,
		M2D_ICommandParameter,
		M2D_ICommandParameterDesc,
		M2D_ICommandSuppParameters,
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
		M2D_ICommandsDuplicateAliasesError,
		M2D_CommandsError
	};
	export {
		M2D_ECommandsErrorSubtypes,
		M2D_CommandUtils,
		M2D_CATEGORIES
	};
//#endregion