/* Tento zdrojový kód je pod licencí GNU/GPL. Mùžete ho použít k vlastní
   potøebì, ale nesmíte jej ani programy založené na tomto kódu využít komerènì!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - debug.h - hlavièkový soubor pro funkce pro ladìní IQ Pokydu
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

void NAHLAS_CHYBU(char *soubor,int radek,BYTE typchyby,BYTE pokracovani);
#define _NESPECIFIKOVANO_ 0
#define _NENALEZEN_ZAKLADNI_SLOVNIK_ 1
#define _NENALEZEN_SOUBOR_S_INTELIGENCI_ 2
#define _SPATNY_ZAKLADNI_SLOVNIK_ 3
#define _SPATNY_UPLNY_SLOVNIK_ 4
#define _SPATNY_SOUBOR_S_INTELIGENCI_ 5
#define _CHYBA_ZAPISU_ 6
#define _MALO_PAMETI_ 7
#define _NEDEALOKOVANY_VSECHNY_BLOKY_ 8
#define _JINA_CHYBA_ 9

#define _UKONCIT_ 0
#define _STORNO_ 1
#define _POKRACOVAT_ 2

void ZKONTROLUJ_SPRAVNOST_UPLNEHO_SLOVNIKU(void);


char *VRAT_TEXT_CHEATU_MISA(void);
