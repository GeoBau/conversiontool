Mapper

über die Zeile mit den buttons sollen 2 input Felder
Syskomp neu: <inpu> Syskomp alt: <input>

Button passt: bekommt 2 zustände:
wemm passt bei "undo inaktiv" wird zu "Passt ?"
wenn passt "inactiv und undo aktiv "Passt bestätigt"
(ausnahme neuaufnahme)

Ablauf
mit zurück/weiter wird katalog produkt gefunden:
button passt/undo sind ausgegraut
top macthes erscheinen.


anwender klickt einen Match aus. 
die Nummern kommen in die inputfelder.
wenn match geklickt wird button "passt" aktiv / undo bleibt inaktiv
user presst "passt" (nicht speichern)
  denn wird passt inaktiv / undo aktiv (aber es wir noch nicht gespeichert)
  wenn user
  - undo presst wird input felder geleert, undo inaktiv, passt aktiv
  - weiter/zurück/exit (jetzt speichern> wenn vorher passt gedrück wurde
  - ohne passt normales blättern
  - wenn wieder ein match gelickt wird: "passt" wird aktiv/"undo" inaktv

Mapper:
Der anwender kann direkt nummer in syskomp neu und alt eingaben.(also kein readonly)
die Eingaben müssen der vereinbarung entsprechen:
- sykomo neu: 9 Stellen (beginnend mit 1)
- sykomp alt: 9 Stellen (beginnend mit 2 oder 4)
user gibt nummern ein, wenn es zulässige nummern sind 
erfolgt
  - Abfrage ob neue nummer in de csv vorliegtn -> message Artnr ist vorhanden "Passt" wird aktiv
  - Wenn neue Nummer neu ist, aber alte vorhanden -> message "Fehler neue Artnr neu / alte ist vorhanden"
  - wenn beide nicht vorhanden sind, ändert sich der Text vom button von "passt" auf "Neuaufnahme"
    wenn Neuafnahme gedrückt Ablauf (wie bei passt, also undo, speichern mit weiter/zurück/exit) 
    beim speichern
    werden syskomp neu und (wenn ausgefüllt) alt und Artikelnummer von Ask/Alvaris gespeichert.
    dazu der Bezeichnungstext von ask/alvaris
    "Neuaufnahme" wird zu "passt"
- wenn neues element der liste gedrückt wird dann anzeige deren Daten im input "Neuaufnahme" wird zu "passt"
- wenn weiter/zurück input felder leeren , "Neuaufnahme" wird zu "passt"