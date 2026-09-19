import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type LibraryPlugin from "./main";
import { isContentType, type ContentType } from "./providers/types";
import { tr } from "./i18n";
import { aniListViewer, anilistAuthUrl } from "./anilistSync";
import { MalTokenManager } from "./malTokenManager";
import { MalAuthModal } from "./ui/malAuthModal";
import { generatePKCEAsync, malAuthUrl } from "./malSync";

export class LibrarySettingTab extends PluginSettingTab {
	private plugin: LibraryPlugin;
	private malTokenManager: MalTokenManager;
	private pkceVerifier: string = '';

	constructor(app: App, plugin: LibraryPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.malTokenManager = new MalTokenManager(plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("p", { text: tr("settings.intro") });

		new Setting(containerEl)
			.setName(tr("settings.omdb.name"))
			.setDesc(tr("settings.omdb.desc"))
			.addText((text) =>
				text
					.setPlaceholder(tr("settings.omdb.placeholder"))
					.setValue(this.plugin.settings.omdbApiKey)
					.onChange(async (v) => {
						this.plugin.settings.omdbApiKey = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("settings.google.name"))
			.setDesc(tr("settings.google.desc"))
			.addText((text) =>
				text
					.setPlaceholder(tr("settings.google.placeholder"))
					.setValue(this.plugin.settings.googleBooksApiKey)
					.onChange(async (v) => {
						this.plugin.settings.googleBooksApiKey = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("settings.rawg.name"))
			.setDesc(tr("settings.rawg.desc"))
			.addText((text) =>
				text
					.setPlaceholder(tr("settings.rawg.placeholder"))
					.setValue(this.plugin.settings.rawgApiKey)
					.onChange(async (v) => {
						this.plugin.settings.rawgApiKey = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("settings.comicvine.name"))
			.setDesc(tr("settings.comicvine.desc"))
			.addText((text) =>
				text
					.setPlaceholder(tr("settings.comicvine.placeholder"))
					.setValue(this.plugin.settings.comicVineApiKey)
					.onChange(async (v) => {
						this.plugin.settings.comicVineApiKey = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("settings.section.anilist"))
			.setHeading();
		containerEl.createEl("p", { text: tr("settings.anilist.desc") });

		new Setting(containerEl)
			.setName(tr("settings.anilist.clientId"))
			.addText((text) =>
				text
					.setPlaceholder(tr("settings.anilist.clientId.placeholder"))
					.setValue(this.plugin.settings.anilistClientId)
					.onChange(async (v) => {
						this.plugin.settings.anilistClientId = v.trim();
						await this.plugin.saveSettings();
					}),
			)
			.addButton((b) =>
				b.setButtonText(tr("settings.anilist.connect")).onClick(() => {
					const id = this.plugin.settings.anilistClientId.trim();
					if (!id) {
						new Notice(tr("settings.anilist.needClientId"));
						return;
					}
					window.open(anilistAuthUrl(id), "_blank");
				}),
			);

		new Setting(containerEl)
			.setName(tr("settings.anilist.token"))
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder(tr("settings.anilist.token.placeholder"))
					.setValue(this.plugin.settings.anilistToken)
					.onChange(async (v) => {
						this.plugin.settings.anilistToken = v.trim();
						await this.plugin.saveSettings();
					});
			})
			.addButton((b) =>
				b.setButtonText(tr("settings.anilist.test")).onClick(async () => {
					const token = this.plugin.settings.anilistToken.trim();
					const viewer = token ? await aniListViewer(token) : null;
					new Notice(
						viewer
							? tr("settings.anilist.connected", { name: viewer.name })
							: tr("settings.anilist.invalidToken"),
					);
				}),
			);

		new Setting(containerEl)
			.setName(tr("settings.section.mal"))
			.setHeading();
		containerEl.createEl("p", { text: tr("settings.mal.desc") });

		new Setting(containerEl)
			.setName(tr("settings.mal.clientId"))
			.addText((text) =>
				text
					.setPlaceholder(tr("settings.mal.clientId.placeholder"))
					.setValue(this.plugin.settings.malClientId)
					.onChange(async (v) => {
						this.plugin.settings.malClientId = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(tr("settings.mal.clientSecret"))
			.addText((text) => {
				text.inputEl.type = "password";
				text
					.setPlaceholder(tr("settings.mal.clientSecret.placeholder"))
					.setValue(this.plugin.settings.malClientSecret)
					.onChange(async (v) => {
						this.plugin.settings.malClientSecret = v.trim();
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(tr("settings.mal.connect"))
			.addButton((b) =>
				b.setButtonText(tr("settings.mal.connect")).onClick(async () => {
					const id = this.plugin.settings.malClientId.trim();
					const secret = this.plugin.settings.malClientSecret.trim();
					if (!id || !secret) {
						new Notice(tr("settings.mal.needClientId"));
						return;
					}
					try {
						const { verifier, challenge } = await generatePKCEAsync();
						this.pkceVerifier = verifier;
						const authUrl = malAuthUrl(id, challenge);
						window.open(authUrl, '_blank');
						new Notice('Opening MAL auth... After login + allow, copy the full redirect URL from browser.');
						
						window.setTimeout(() => {
							new MalAuthModal(this.app, this.plugin, this.malTokenManager, this.pkceVerifier, () => {
								this.display();
							}).open();
						}, 500);
					} catch {
						new Notice('Failed to generate pkce challenge');
					}
				}),
			);

const tokens = this.plugin.settings.malTokens;
		const daysLeft = this.malTokenManager.getDaysUntilExpiry(tokens);
		const statusText = daysLeft !== null && daysLeft >= 0
			? tr('settings.mal.tokenStatus', { days: daysLeft })
			: tr('settings.mal.tokenExpired');
		
		new Setting(containerEl)
				.setName(tr("settings.mal.tokenStatus"))
				.setDesc(statusText)
				.addButton((b) =>
					b.setButtonText(tr("settings.mal.refreshNow")).onClick(async () => {
						b.setButtonText(tr("settings.mal.refreshing"));
						b.setDisabled(true);
						try {
							const newToken = await this.malTokenManager.getValidAccessToken();
							if (newToken) {
								new Notice(tr("settings.mal.refreshSuccess"));
								this.display();
							} else {
								new Notice(tr("settings.mal.refreshFailed", { error: 'No refresh token available' }));
							}
						} catch (e) {
							const errorMsg = e instanceof Error ? e.message : String(e);
							new Notice(tr("settings.mal.refreshFailed", { error: errorMsg }));
						} finally {
							b.setButtonText(tr("settings.mal.refreshNow"));
							b.setDisabled(false);
						}
					}),
				)
				.addButton((b) =>
					b.setButtonText(tr("settings.mal.test")).onClick(async () => {
						const token = await this.malTokenManager.getValidAccessToken();
						if (!token) {
							new Notice(tr("settings.mal.invalidToken"));
							return;
						}
						const viewer = await this.malTokenManager.testConnection(token);
						new Notice(
							viewer
								? tr("settings.mal.connected", { name: viewer.name })
								: tr("settings.mal.invalidToken"),
						);
					}),
				)
				.addButton((b) =>
					b.setButtonText('Clear Tokens').setWarning().onClick(() => {
						this.malTokenManager.clearTokens();
						void this.plugin.saveSettings();
						this.display();
					}),
				);

		new Setting(containerEl)
			.setName(tr("settings.section.categories"))
			.setHeading();
		containerEl.createEl("p", { text: tr("settings.categories.desc") });

		this.plugin.settings.categories.forEach((cat, i) => {
			const div = containerEl.createDiv({
				cls: "library-settings-category",
			});

			new Setting(div)
				.setName(tr("settings.category.name", { index: i + 1 }))
				.setDesc(tr("settings.category.desc"))
				.addText((t) =>
					t
						.setPlaceholder(
							tr("settings.category.name.placeholder"),
						)
						.setValue(cat.name)
						.onChange(async (v) => {
							cat.name = v.trim();
							await this.plugin.saveSettings();
						}),
				)
				.addText((t) =>
					t
						.setPlaceholder(
							tr("settings.category.type.placeholder"),
						)
						.setValue(cat.typeValue)
						.onChange(async (v) => {
							cat.typeValue = v.trim();
							await this.plugin.saveSettings();
						}),
				)
				.addDropdown((d) =>
					d
						.addOption("movie", "OMDb · " + tr('settings.default.movie'))
						.addOption("series", "OMDb · " + tr('settings.default.series'))
						.addOption("anime", "AniList · " + tr('settings.default.anime') + " (free)")
						.addOption("anime-mal", "MyAnimeList · " + tr('settings.default.anime-mal') + " (OAuth)")
						.addOption("book", "Books · " + tr('settings.default.book'))
						.addOption("comic", "Comic Vine · " + tr('settings.default.comic'))
						.addOption("game", "RAWG · " + tr('settings.default.game'))
						.addOption("music", "Deezer · " + tr('settings.default.music'))
						.addOption("manual", tr("settings.category.manual"))
						.setValue(cat.contentType)
						.onChange(async (v) => {
							if (isContentType(v)) cat.contentType = v;
							await this.plugin.saveSettings();
						}),
				)
				.addButton((b) =>
					b
						.setIcon("trash")
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.categories.splice(i, 1);
							await this.plugin.saveSettings();
							this.display();
						}),
				);

			new Setting(div)
				.setName(tr("settings.category.folder"))
				.addText((t) =>
					t
						.setPlaceholder(
							tr("settings.category.folder.placeholder"),
						)
						.setValue(cat.folder)
						.onChange(async (v) => {
							cat.folder = v.trim();
							await this.plugin.saveSettings();
						}),
				);
		});

		const addDiv = containerEl.createDiv({ cls: 'library-settings-category' })
		let addValue = 'movie'
		new Setting(addDiv)
			.setName(tr('settings.addCategory'))
			.addDropdown((d) => {
				d.addOption('movie', tr('settings.default.movie'))
				d.addOption('series', tr('settings.default.series'))
				d.addOption('book', tr('settings.default.book'))
				d.addOption('comic', tr('settings.default.comic'))
				d.addOption('game', tr('settings.default.game'))
				d.addOption('music', tr('settings.default.music'))
				d.addOption('anime', tr('settings.default.anime'))
				d.addOption('anime-mal', tr('settings.default.anime-mal'))
				d.addOption('manual', tr('settings.default.manual'))
				d.setValue('movie')
				d.onChange((v) => { addValue = v })
			})
			.addButton((b) =>
				b
					.setButtonText(tr('settings.addCategory'))
					.setCta()
					.onClick(async () => {
						const typeMap: Record<string, { name: string; typeValue: string; contentType: ContentType }> = {
							movie: { name: tr('settings.default.movie'), typeValue: 'Movie', contentType: 'movie' },
							series: { name: tr('settings.default.series'), typeValue: 'Series', contentType: 'series' },
							book: { name: tr('settings.default.book'), typeValue: 'Book', contentType: 'book' },
							comic: { name: tr('settings.default.comic'), typeValue: 'Comic', contentType: 'comic' },
							game: { name: tr('settings.default.game'), typeValue: 'Game', contentType: 'game' },
							music: { name: tr('settings.default.music'), typeValue: 'Music', contentType: 'music' },
							anime: { name: tr('settings.default.anime'), typeValue: 'Anime', contentType: 'anime' },
							'anime-mal': { name: tr('settings.default.anime-mal'), typeValue: 'Anime', contentType: 'anime-mal' },
							manual: { name: tr('settings.default.manual'), typeValue: 'Manual', contentType: 'manual' },
						}
						const def = typeMap[addValue]
						if (!def) return
						this.plugin.settings.categories.push({
							name: def.name,
							typeValue: def.typeValue,
							contentType: def.contentType,
							folder: '',
						})
						await this.plugin.saveSettings()
						this.display()
					})
			)

		new Setting(containerEl)
			.setName(tr("settings.section.example"))
			.setHeading();
		containerEl.createEl("p", { text: tr("settings.example.desc") });
		containerEl.createEl("pre").setText(
			"---\nType: Movie\nURL: https://www.imdb.com/title/tt.....\n---"
		);
	}
}
