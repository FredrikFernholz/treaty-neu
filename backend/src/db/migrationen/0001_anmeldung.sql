CREATE TABLE `benutzer_zusatzrecht` (
	`benutzer_id` int unsigned NOT NULL,
	`recht` enum('buchhaltung','leistungskatalog','kunden','nutzerverwaltung','auswertungen','zeiterfassung_alle') NOT NULL,
	CONSTRAINT `benutzer_zusatzrecht_benutzer_id_recht_pk` PRIMARY KEY(`benutzer_id`,`recht`)
);
--> statement-breakpoint
CREATE TABLE `sicherheitsprotokoll` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`zeitpunkt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`ereignis` enum('anmeldung_erfolgreich','anmeldung_fehlgeschlagen','sperre','passwort_geaendert','einmalpasswort_vergeben','sitzung_beendet') NOT NULL,
	`benutzer_id` int unsigned,
	`kuerzel_eingabe` varchar(50),
	`ausgeloest_von_id` int unsigned,
	`ip` varchar(45),
	`user_agent` varchar(500),
	`grund` varchar(100),
	CONSTRAINT `sicherheitsprotokoll_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sitzung` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`token_hash` char(64) NOT NULL,
	`benutzer_id` int unsigned NOT NULL,
	`erstellt_am` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`laeuft_ab_am` datetime(3) NOT NULL,
	`letzte_aktivitaet_am` datetime(3) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`user_agent` varchar(500),
	CONSTRAINT `sitzung_id` PRIMARY KEY(`id`),
	CONSTRAINT `sitzung_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `benutzer` ADD `passwort_wechsel_noetig` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `benutzer_zusatzrecht` ADD CONSTRAINT `benutzer_zusatzrecht_benutzer_id_benutzer_id_fk` FOREIGN KEY (`benutzer_id`) REFERENCES `benutzer`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sicherheitsprotokoll` ADD CONSTRAINT `sicherheitsprotokoll_benutzer_id_benutzer_id_fk` FOREIGN KEY (`benutzer_id`) REFERENCES `benutzer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sicherheitsprotokoll` ADD CONSTRAINT `sicherheitsprotokoll_ausgeloest_von_id_benutzer_id_fk` FOREIGN KEY (`ausgeloest_von_id`) REFERENCES `benutzer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sitzung` ADD CONSTRAINT `sitzung_benutzer_id_benutzer_id_fk` FOREIGN KEY (`benutzer_id`) REFERENCES `benutzer`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `sicherheitsprotokoll_zeitpunkt` ON `sicherheitsprotokoll` (`zeitpunkt`);--> statement-breakpoint
CREATE INDEX `sicherheitsprotokoll_benutzer` ON `sicherheitsprotokoll` (`benutzer_id`,`zeitpunkt`);--> statement-breakpoint
CREATE INDEX `sitzung_laeuft_ab_am` ON `sitzung` (`laeuft_ab_am`);