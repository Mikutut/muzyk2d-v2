//#region Imports
	import { MessageOptions, EmbedField, MessageSelectMenu, MessageEmbed } from "discord.js";
  import { M2D_LogUtils } from "./log";
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
	"clientInvokingCommandError": {
			type: "error",
			title: `Błąd!`,
			description: `Wystąpił błąd podczas **wykonywania komendy** \`%s\`.\n\n**Oznaczenie błędu**: \`%s\`\n**Dane o błędzie**: \`%s\``
	},
	"commandsHelpShowCommandsFromCategory": {
		type: "info",
		title: `Informacje o komendach z kategorii "%s"`,
		description: `%s`
	},
	"commandsHelpNoCategoryProvided": {
		type: `error`,
		title: `Nie podano kategorii!`,
		description: `Nie podano żadnej kategorii, z której miałyby zostać wyświetlone komendy.\n**Oto lista dostępnych kategorii**:\n\`\`\`%s\`\`\``
	},
	"commandsStatus": {
		type: `info`,
		title: `Muzyk2D - status`,
		description: `**Połączenie z kanałem głosowym**:\n**Status**:%s\n**Nazwa kanału**:%s\n\n**Playlista**:\n**Status**:%s\n**Wielkość**:%s\n**Obecna pozycja**:%s\n\n**Odtwarzanie**:\n**Status**:%s\n**Tryb odtwarzania**:%s\n\n**Ogólne**:\n**Wersja**:%s`
	},
	"generalScheduleShutdown": {
		type: "info",
		title: "Zaplanowano wyłączenie",
		description: `Za %s sekund nastąpi **planowe wyłączenie Muzyka2D**\n\n**Powód**:\n%s`
	},
	"generalStartupMessage": {
		type: `info`,
		title: `Muzyk2D został aktywowany!`,
		description: `Wszystkie moduły zostały poprawnie zainicjalizowane!\n\n**Wersja**: \`%s\`\nby %s%s`
	},
	"generalDevMessage": {
		type: "info",
		title: "Wiadomość od dewelopera",
		description: `Deweloper wysłał następującą wiadomość:\n%s`
	},
	"playbackDownloadingStream": {
		type: "info",
		title: `Pobieranie strumienia...`,
		description: `Muzyk2D rozpoczął proces pobierania strumienia z YouTube.\n\n**W przeciągu %s sekund powinno rozpocząć się odtwarzanie utworu.**`
	},
	"playbackStreamDownloadTimedOut": {
		type: "error",
		title: `Nie udało się pobrać strumienia!`,
		description: `Nie udało się pobrać strumienia z YouTube w wyznaczonym czasie.`
	},
	"playbackStreamDownloadError": {
		type: "error",
		title: `Nie udało się pobrać strumienia!`,
		description: `Podczas pobierania strumienia z YouTube wystąpił błąd. Spróbuj ponownie.`
	},
	"playbackStarted": {
		type: "success",
		title: `Rozpoczęto odtwarzanie!`,
		description: `Rozpoczęło się odtwarzanie "%s" (%s) z pozycji \`%s\`.`
	},
	"playbackPaused": {
		type: "success",
		title: `Zapauzowano!`,
		description: `Pomyślnie **zapauzowano odtwarzanie**!`
	},
	"playbackIdling": {
		type: "info",
		title: `Brak pracy`,
		description: `Odtwarzacz przeszedł w stan braku pracy. Jeśli utrzyma się w takim stanie przez %s sekund, odtwarzanie zostanie **zniszczone**.`
	},
	"playbackTimedOut": {
		type: "info",
		title: `Odtwarzanie zniszczone!`,
		description: `Odtworzenie było zapauzowane/zastopowane przez zbyt długi czas, dlatego też zostało ono **zniszczone**. Aby odtworzyć utwór jeszcze raz, skorzystaj z komendy \`odtwórz\`.`
	},
	"playbackUnpaused": {
		type: "success",
		title: `Odpauzowano!`,
		description: `Pomyślnie **odpauzowano odtwarzanie**!`
	},
	"playbackStopped": {
		type: "success",
		title: `Zastopowano!`,
		description: `Pomyślnie **zastopowano odtwarzanie**!`
	},
	"playbackSongSkipped": {
		type: "success",
		title: `Przewinięto pozycję!`,
		description: `Pomyślnie **przewinięto do następnej pozycji na playliście**!`
	},
	"playbackSwitchedMode": {
		type: "success",
		title: "Przełączono tryb!",
		description: `Zmieniono tryb odtwarzania na **%s**`
	},
	"playlistAddedEntry": {
		type: "success",
		title: "Dodano wpis do playlisty!",
		description: `Pomyślnie **dodano nowy wpis do playlisty**!\n\n**ID wpisu**: \`%s\``
	},
	"playlistDeletedEntry": {
		type: "success",
		title: "Usunięto wpis!",
		description: `Pomyślnie **usunięto wpis o ID** \`%s\` **z playlisty**!`
	},
	"playlistFlushedPlaylist": {
		type: "success",
		title: `Wyczyszczono playlistę!`,
		description: `Pomyślnie **wyczyszczono playlistę**!`
	},
	"playlistEmptyPlaylist": {
		type: "error",
		title: `Playlista`,
		description: `Playlista jest **pusta**!`
	},
	"playlistShowPlaylist": {
		type: "info",
		title: `Playlista`,
		description: "%s"
	},
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
	},
	"voiceTooFewVCMembersDetected": {
		type: `info`,
		title: `Wykryto zbyt niską liczbę członków na kanale!`,
		description: `W związku z tym, po upływie %s sekund, nastąpi automatyczne rozłączenie z kanału.`
	},
	"voiceTooFewVCMembersTimeoutFinished": {
		type: `info`,
		title: `Zbyt niska liczba członków na kanale utrzymała się przez zbyt długi czas!`,
		description: `Nastąpiło automatyczne rozłączenie z kanału.`
	},
	"youtubeAPIWrongUrl": {
		type: "error",
		title: "Niepoprawny URL!",
		description: `Podany URL (\`%s\`) nie jest **prawidłowym linkiem do wideo na YouTube**!`
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
	getMessage: (key: string, replaces?: string[], thumbnailUrl?: string, imageUrl?: string, fields?: EmbedField[]) => new Promise<MessageEmbed>((res, rej) => {
		if(M2D_MESSAGES[key]) {
			const message = { ...M2D_MESSAGES[key] };

			const titleInsertsCount = (message.title) ? M2D_MessagesUtils.countInserts(message.title) : 0;
			const descInsertsCount = M2D_MessagesUtils.countInserts(message.description);

			const titleReplaces: string[] = [];
			const descReplaces: string[] = [];

			if(titleInsertsCount + descInsertsCount > 0) {
				if(replaces) {
					if(replaces.length === (titleInsertsCount + descInsertsCount)) {
						for(let i = 0; i < (titleInsertsCount + descInsertsCount); i++) {
							if(i < titleInsertsCount) {
								titleReplaces.push(replaces[i]);
							} else {
								descReplaces.push(replaces[i]);
							}
						}

						M2D_MessagesUtils.replaceInserts(message.description, ...descReplaces)
							.then((repDesc: string) => {
								if(message.title) {
									return M2D_MessagesUtils.replaceInserts(message.title, ...titleReplaces)
										.then((repTitle: string) => {
											message.title = repTitle;
											message.description = repDesc;
										})
								} else {
									message.description = repDesc;
									return Promise.resolve();
								}
							})
							.then(() => {
								if(thumbnailUrl) message.thumbnailURL = thumbnailUrl;
								if(imageUrl) message.imageURL = imageUrl;
								if(fields) message.fields = fields;

								return Promise.resolve(M2D_GeneralUtils.embedBuilder(message));
							})	
							.then((val) => res(val))
							.catch((err) => rej(err));
					} else rej({
						type: M2D_EErrorTypes.Messages,
						subtype: M2D_EMessagesErrorSubtypes.InsertsReplacesMismatch,
						data: {
							strings: (message.title) ? [message.title, message.description] : [message.description],
							insertsCount: titleInsertsCount + descInsertsCount,
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
				if(thumbnailUrl) message.thumbnailURL = thumbnailUrl;
				if(imageUrl) message.imageURL = imageUrl;
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