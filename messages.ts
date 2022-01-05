//#region Imports
	import { MessageOptions, EmbedField, MessageSelectMenu, MessageEmbed } from "discord.js";
	import { M2D_EErrorTypes, M2D_GeneralUtils, M2D_IEmbedOptions, M2D_IError } from "./utils";
//#endregion

//#region Types
	interface M2D_IMessages {
		[key: string]: M2D_IEmbedOptions;
	};
	//#region Error types
		const enum M2D_EMessagesErrorSubtypes {
			InsertsReplacesMismatch = "INSERTS_REPLACES_MISMATCH",
			NoReplacesProvided = "NO_REPLACES_PROVIDED",
			MessageNotFound = "MESSAGE_NOT_FOUND"
		};
		interface M2D_IMessagesInsertsReplacesMismatchError extends M2D_IError {
			data: {
				strings: string[];
				insertsCount: number;
				replacesCount: number;
			}
		};
		interface M2D_IMessagesNoReplacesProvidedError extends M2D_IError {
			data: {
				messageKey: string;
			}
		};
		interface M2D_IMessagesMessageNotFoundError extends M2D_IError {
			data: {
				messageKey: string;
			}
		};
		type M2D_MessagesError = M2D_IMessagesInsertsReplacesMismatchError |
			M2D_IMessagesNoReplacesProvidedError |
			M2D_IMessagesMessageNotFoundError;
	//#endregion
//#endregion

const M2D_MESSAGES: M2D_IMessages = {
	"voiceUserNotInVoiceChannel": {
		title: "Błąd!",
		description: `**Nie znajdujesz się na żadnym kanale głosowym**, więc Muzyk2D **nie wie, gdzie ma dołączyć**!`,
		type: "error"
	},
	"voiceClientNotInVoiceChannel": {
		type: "error",
		title: "Błąd!",
		description: `Muzyk2D **nie znajduje się obecnie na żadnym kanale głosowym**!`
	},
	"voiceClientAlreadyInVoiceChannel": {
		title: "Błąd!",
		description: `Muzyk2D **już znajduje się na kanale głosowym**!`,
		type: "error"
	},
	"voiceConnectedToVoiceChannel": {	
		type: "success",
		title: "Dołączono!",
		description: `Pomyślnie dołączono na kanał **%s**!`
	},
	"voiceDisconnectedFromVoiceChannel": {
		type: "success",
		title: "Odłączono!",
		description: `Pomyślnie odłączono z kanału głosowego!`
	}
};

const M2D_MessagesUtils = {
	countInserts: (str: string) => (str.match(/%s/g) || []).length,
	replaceInserts: (str: string, ...replaces: string[]) => new Promise<string>((res, rej) => {
		if(M2D_MessagesUtils.countInserts(str) === 0) res(str);
		else if(M2D_MessagesUtils.countInserts(str) !== replaces.length) rej({
			type: M2D_EErrorTypes.Messages,
			subtype: M2D_EMessagesErrorSubtypes.InsertsReplacesMismatch,
			data: {
				strings: [str],
				insertsCount: M2D_MessagesUtils.countInserts(str),
				replacesCount: replaces.length
			}
		} as M2D_IMessagesInsertsReplacesMismatchError);
		else {
			let outStr = str;
			for(const v of replaces) {
				outStr = outStr.replace(/%s/, v);
			}
			res(outStr);
		}
	}),
	getMessage: (key: string, replaces?: string[], fields?: EmbedField[]) => new Promise<MessageEmbed>((res, rej) => {
		if(M2D_MESSAGES[key]) {
			const message = { ...M2D_MESSAGES[key] };
			const titleInsCount = ((message.title) ? M2D_MessagesUtils.countInserts(message.title) : 0);
			const descInsCount = M2D_MessagesUtils.countInserts(message.description);
			const totalInsCount = descInsCount + titleInsCount;

			if(totalInsCount > 0) {
				if(replaces) {
					if(replaces.length === totalInsCount) {
						M2D_MessagesUtils.replaceInserts(message.description, ...replaces.slice(titleInsCount, descInsCount))
							.then((outDesc: string) => {
								if(message.title) {
									M2D_MessagesUtils.replaceInserts(message.title, ...replaces.slice(0, titleInsCount))
										.then((outTitle: string) => {
											message.title = outTitle;
										})
										.catch((err) => rej(err));
								}

								message.description = outDesc;
								
								if(fields) message.fields = fields;
								
								res(M2D_GeneralUtils.embedBuilder(message));
							})
							.catch((err) => rej(err));
					} else rej({
						type: M2D_EErrorTypes.Messages,
						subtype: M2D_EMessagesErrorSubtypes.InsertsReplacesMismatch,
						data: {
							strings: (message.title) ? [message.title, message.description] : [message.description],
							insertsCount: totalInsCount,
							replacesCount: replaces.length
						}
					} as M2D_IMessagesInsertsReplacesMismatchError);
				} else rej({
					type: M2D_EErrorTypes.Messages,
					subtype: M2D_EMessagesErrorSubtypes.NoReplacesProvided,
					data: {
						messageKey: key
					}
				} as M2D_IMessagesNoReplacesProvidedError);
			} else {
				if(fields) message.fields = fields;
				res(M2D_GeneralUtils.embedBuilder(message));
			}
		} else rej({
			type: M2D_EErrorTypes.Messages,
			subtype: M2D_EMessagesErrorSubtypes.MessageNotFound,
			data: {
				messageKey: key
			}
		} as M2D_IMessagesMessageNotFoundError);
	})
};

//#region Exports
	export type {
		M2D_IMessagesInsertsReplacesMismatchError,
		M2D_IMessagesNoReplacesProvidedError,
		M2D_IMessagesMessageNotFoundError,
		M2D_MessagesError
	};
	export {
		M2D_EMessagesErrorSubtypes,
		M2D_MessagesUtils
	};
//#endregion