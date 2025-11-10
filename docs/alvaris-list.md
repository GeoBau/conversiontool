es soll nummern von alvaris mit nummern aus einer excel datei abgegleichen werden.


mache einen filedialog für einfüge suchnummern.

Die suchnummer befinden sich in  Portfolio_Syskomp_pA.xlsx in Spalte I.

Es sind nicht alle zeilen belegt, es geht nur um die zeilen mit inhalt.

Die zeilen sind belegt mit item-nr, die wegen dem Format einen string sein muss


gehe alle zeilen durch, mit dem aufruf der suchnummer.


bei Aufruf der url mit der suchnummer.

<https://www.alvaris.com/de/?s=0.0.411.15&trp-form-language=de>

[https://www.alvaris.com/de/?s=<suchnummer>&trp-form-language=de](https://www.alvaris.com/de/?s=0.0.411.15&trp-form-language=de)

wird nach suchen und pause


wenn keine Nummer zurückkommt

<h1 data-no-translation="" data-trp-gettext="">Nichts gefunden</h1>

in dem fall artnr=matnr=bez=”-”


<div class="uk-width-expand@m uk-first-column">

<nav class="uk-margin-medium-bottom" aria-label="Brotkrümel" data-no-translation-aria-label="">
<ul class="uk-breadcrumb">

```
        <li>            <a href="https://www.alvaris.com/de/"><span data-no-translation="" data-trp-gettext="">Leistungsspektrum</span></a>
        </li>    
        <li>            <span aria-current="page">0.0.411.14</span>            </li>    
</ul>
```

</nav>

```
<div class="uk-h3 uk-margin-medium-bottom" data-no-translation="" data-trp-gettext="">Suchergebnisse für „<span>0.0.411.14</span>“</div>

<div class="uk-grid uk-child-width-1-1 uk-grid-stack" uk-grid="">
            <div class="uk-first-column">
```

<article id="post-4219" class="uk-article post-4219 post type-post status-publish format-standard hentry category-aluminiumprofile-system-a">

```
<h2><a class="uk-link-reset" href="https://www.alvaris.com/de/2022/02/11/1010634-winkelleiste-al-8/">1010634-Winkelleiste-Al-8</a></h2>
    <p class="uk-article-meta">
    Geschrieben von <a href="https://www.alvaris.com/de/author/markus/">Markus Bessler</a> am <time datetime="2022-02-11T11:01:11+01:00">11. Februar 2022</time>.
    Veröffentlicht in <a href="https://www.alvaris.com/de/category/aluminiumprofile-system-a/" rel="category tag">Aluminiumprofile SYSTEM A</a>.    </p>

<div class="uk-margin-medium">
    <p>Winkelleiste AL Nut 8 Winkelleiste zur universellen Befestigung von Flächenelementen und als Anschlagleiste für Türen verwendbar. Sie kann nachträglich in die Nut der Profilserie 8 eingeschwenkt und mit Gewindestiften fixiert werden. Artikelbeschreibung Artikelnummer 1010634 / WINAL AlMgSi0,5 EN AW-6060 T6, E6 eloxiert L = 6.000 +10/-5 mm m = 0,33 kg/m A = 1,23 cm2 […]</p>
</div>
```

</article>
</div>
</div>

```
                                            </div>
```


ausgegeben:

vergleiche: kommt in <span aria-current="page">0.0.411.14</span>  die suchnummer vor


bez: kommt aus leiste-al-8/">1010634-Winkelleiste-Al-8</a></h2 →Winkelleiste-Al-8


```
 Artikelbeschreibung Artikelnummer 1010634 / WINAL AlMgSi0,5 EN AW-6060 T6, E6 eloxiert L = 6.000 
```

artnr: Artikelbeschreibung Artikelnummer 1010634 / WINAL AlMgSi0,5 EN AW-6060 T6, E6 eloxiert L = 6.000  → 1010634

matnr: Artikelbeschreibung Artikelnummer 1010634 / WINAL AlMgSi0,5 EN AW-6060 T6, E6 eloxiert L = 6.000  → WINAL




scjreibe in die  Portfolio_Syskomp_pA_neu.xlsx 

in Spalte N artnr und in Spalte O matnr

derjenigen Zeile


