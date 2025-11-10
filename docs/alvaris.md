I want to read artnr, descrption and image from a catalog from Alvaris.

<https://www.alvaris.com/de/uebersicht-system-a/>

this is simiar to ask.py. design of the page is the same.

We can only not page through different pages


we have some changes:

we do not page through a catalog.

we have different catalogs, each is a one pager.

so we pass each url.

Die ausgabe datei is always the same so the new item must be added to existent data.


Each item on this page looks like this:

artnr=1003871

description=Profil  30×30 2N 90° Nut B8 

do not load the give png (too many requests) copy the rendered picture and save it as 1010404.png


```
<a class="uk-display-block uk-panel uk-link-toggle" href="/de/2022/03/08/1003871-profil-b8-30x30-nut-8-2n/">    
        
            
                
            
            
                                

    
                <picture>
<source type="image/webp" srcset="/wp-content/themes/yootheme/cache/76/Profil_1003871_PRO_B8_3030_2NVS-76205744.webp 200w, /wp-content/themes/yootheme/cache/a1/Profil_1003871_RO_B8_3030_2NVS-a192a375.webp 400w" sizes="(min-width: 200px) 200px">
<img decoding="async" src="/wp-content/themes/yootheme/cache/15/Profil_1003871_PRO_B8_3030_2NVS-15af09f7.jpeg" width="200" height="200" alt="" loading="lazy" class="el-image">
</picture>        
        
    
                
                                <div class="uk-padding-small uk-margin-remove-first-child">                
                    

        
                <h3 class="el-title uk-h6 uk-font-default uk-text-danger uk-margin-top uk-margin-remove-bottom">                        Profil  30×30 2N 90° Nut B8                    </h3>        
        
    
        
        
        
        
        

                                </div>                
                
            
        
        </a>
```

the item are distributed over the page.


