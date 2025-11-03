das conversion tool wird neu gemacht.
mache ein Tool aus react.

orientier dirch an app.tsx
füge den Auswahl dialog dazu

Es gibt eine Datenbasis Portfolio_Syskomp_pA.xlsx
In der Daten gibt es folgende Spalten
A: Syskomp neue Nummer
B: Syskomp alte Nummer
C: Syskomp Beschreibung
D: Item
E: Bosch
F: Alvaris Artnr
G: Alvaris Matnr
H: ASK
`120000553	261603000it	Aluminiumprofil 60x30L;Nut 6;8 St. x 6000mm;	0.0.419.07		1010417	PRO8.6030 140000067	403538558	Dämpfungsplatte für;Gelenkstellfuß 60 Material:;thermoplastischer Elastomer;	0.0.439.33	3842538558	1010072	ANTSTE8.60 `

Das conversionTool kann nach auswahl von A-G -> B und A ummappen (nur diese Version gibt es extern über vercel)
Intern vom terminalserver geht es auch von A oder B -> nach Auswahl A-G ummappen
Es soll kein mapping geben ohne A,B involviert (zb D->G ist nicht erlaubt)
enspricht gilt es für das tool über batch verarbeitung

zeige im Ergebnis
Suchnr -> Zielnummer (sonder Fall Alvaris: zeige Arnt/Matnr)
Beschreibung (; bedeute neue Zeile)
Unterder Bschreibung ist ein Bild wennmöglich:
wenn die artnr von Alvaris ein bild <artnr.png> unter alvaris-catalog/alvaris-bosch-images oder alvaris-catalog/alvaris-item-images wen ein bild vorhanden ist - oder dasselbe für ASK-catalog.
Zeige beim Bild von Alvaris nur 70% von  der oberden Seite des BIldes.

Tausche Im batch Die Suchnr gegen nach Auswahl die SyskompnrA oder B.
