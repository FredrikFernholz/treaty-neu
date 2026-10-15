CREATE TABLE `benutzer` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`kuerzel` varchar(10) NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`passwort_hash` varchar(255) NOT NULL,
	`berechtigung` enum('administrator','sachbearbeiter') NOT NULL,
	`zeichnung` enum('ppa','iv','ia','ohne') NOT NULL DEFAULT 'ohne',
	`bezeichnung` varchar(100),
	`aktiv` boolean NOT NULL DEFAULT true,
	`totp_secret` varchar(255),
	`version` int unsigned NOT NULL DEFAULT 1,
	`erstellt_am` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`geaendert_am` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `benutzer_id` PRIMARY KEY(`id`),
	CONSTRAINT `benutzer_kuerzel_unique` UNIQUE(`kuerzel`),
	CONSTRAINT `benutzer_email_unique` UNIQUE(`email`)
);
