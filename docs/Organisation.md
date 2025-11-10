Es soll ein Tool gebaut werden um Artikelnummern zwsichen syskomp und Bosch, bzw Syskomp und Item zuweisen zu können.

Bosch hat 10 stellige Nummern

syskomp 9 stellig

und Item sprechende nummern: 0.0.0.0 (mit 3 punkten)


Die daten sind in dem Excelfile  20210319_artikel.xlsx in Tab 20210319_artikel in Spalte A und B erfasst.

bis Zeile 3630.

In Spalte C und D Bez1 und Bez2.

In Spalte E ist die Warengruppennummer teilweise angegeben.


Abzeile 3644 bis 3662 ist die Zuweisung der Warengruppe Spalte A zur Beschreibung in Spalte B ngegeben.


Schreibe ein App in Python und React.

im Input Feld kann der Customer eine Nummer eingeben- die App soll die zugehörige Nummer ausgeben mit Angabe Bosch/Item/Syskom der Inputnummer und der Korrespondierenden Nummer mit Bez1 und Bez2 und evetuell Warengruppe.

Eine Besonderheiut in der Eingabe läßt der Customer auch die punkte weg, darauf musst du trotzdem die passende Nummer finden. wenn es mehrdeutig ist gebe einen Hinweis.


Prüfe die Arikelnummern im esxcel file ob sie der Vorgabe der Nummern formate entsprechen.

Gebe die Zeile aus , wo es nicht passt.


Ermögliche die Eingabe einer Excelliste (upload mit file Auswahl dialog oder rüberziehen) mit Angabe der Spalte.

Prüfe ob alle Nummern ausggetauscht werden können 

wenn ja tausche die Nummern in das Syskom system.