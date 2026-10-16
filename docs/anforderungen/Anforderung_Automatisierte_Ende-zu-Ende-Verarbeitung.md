# Anforderung: Automatisierte Ende-zu-Ende-Verarbeitung im Betriebskostenmodul

## Herkunft

Diese Anforderung wurde von der Geschäftsführung mitgeteilt und für die Aufnahme in den Anforderungskatalog vorbereitet. Sie ist bislang eine strategische Zielvorgabe und noch keine im Fachteam im Detail abgestimmte, funktionale Anforderung wie die bestehenden Positionen im Anforderungskatalog.

## Kernanforderung

Der Kunde soll die Nebenkostenabrechnung (NKA) und zugehörige Unterlagen wie den Mietvertrag (MV) selbst hochladen. Diese Unterlagen sollen automatisch in Treaty einlaufen, dort automatisiert weiterverarbeitet werden, und am Ende der Verarbeitung soll die Rechnung automatisch erstellt werden, ohne dass dafür ein manueller Zwischenschritt nötig ist.

## Umgang mit Sonderfällen

Für Kunden mit besonderen, vom Standardablauf abweichenden Anforderungen, im Original als "Extra Würste" bezeichnet, wie etwa den Kunden VOD, sollen ergänzend externe Automatisierungswerkzeuge wie Claude Cowork sowie make.com oder n8n eingesetzt werden. Diese Werkzeuge sollen die notwendigen Unterlagen bei Bedarf automatisiert abholen und die Ergebnisse anschließend wieder in den Prozess zurückspielen.

## Grundprinzip

Innerhalb von Treaty selbst soll es ausdrücklich keine Medienbrüche geben. Der manuelle Arbeitsaufwand soll auf ein Minimum reduziert werden, und überall dort, wo es möglich ist, sollen Automatisierungswerkzeuge wie Claude, Make oder n8n die Arbeit übernehmen statt manueller Bearbeitung durch Mitarbeitende.

## Einordnung in den bestehenden Anforderungskatalog

Von der Geschäftsführung geklärt: Diese Anforderung setzt den übergeordneten Rahmen für die bereits im Anforderungskatalog dokumentierten Positionen zur automatischen Texterkennung beim Hochladen (Nr. 31) und zur Rechnungserstellung im Modul Buchhaltung (Abschnitt 13 der Entwicklerdokumentation) und ergänzt diese, sie ersetzt sie nicht.

## Offener Punkt vor Aufnahme in den verbindlichen Anforderungskatalog

Diese Anforderung ist bislang eine strategische Zielvorgabe. Für eine spätere technische Umsetzung und Priorisierung im Fachteam wäre es hilfreich, sie in konkrete, einzeln überprüfbare Teilschritte herunterzubrechen, ähnlich wie es bei den bestehenden Positionen im Anforderungskatalog bereits der Fall ist, etwa welche Uploadwege für den Kunden vorgesehen sind, welche Verarbeitungsschritte in Treaty automatisiert werden sollen und welche Schnittstelle zwischen Treaty und den externen Werkzeugen Claude Cowork, make.com und n8n für die Sonderfälle vorgesehen ist.
