/* Tento zdrojový kód je pod licencí GNU/GPL. Mùžete ho použít k vlastní
   potøebì, ale nesmíte jej ani programy založené na tomto kódu využít komerènì!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - prostred.h - "háèkový" soubor pro funkce pro prostøedí programu
   ve Windows
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

#define MAX_POCET_ZVUKU_TUKNUTI 10


CString _NAJDI_BASNICKE_SLOVO(char *koncovka);
BYTE ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE(CString &cjmeno);
void ROZEBER_PRIKAZOVY_RADEK(void);
DWORD VRAT_BARVU_TEXTU(HWND hWnd);
void NAPIS_VETU_S_ODPOVEDI_NA_OBRAZOVKU(char *vetacloveka,char *vetapocitace);
void NAPIS_VETU_S_ODPOVEDI_NA_OBRAZOVKU(CString vetacloveka,CString vetapocitace);
void NASTAV_VIDITELNOST_EFEKTNICH_PROGRESSBARU(void);

void ZOBRAZ_HLASKU_NA_POZADI(char kterou,HWND nacem);
#define _PREKRESLIT_OBRAZOVKU_ 1
#define _UVODNI_KEC_ 2
#define _O_VYTVARENI_SLOVNIKU_ 3
#define _NEKDO_SI_HRAL_S_NASTAVENIM_ 4

void ZAPIS_INFORMACI_O_NEZNAMEM_SLOVE(char *slovo);
void IQ_POKYDE_ODPOVEZ(char *vetacloveka);
void ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI(void);
void NAPIS_UVODNI_UVITANI(void);
void ZMEN_FONT_U_TEXTU_NA_OBRAZOVCE(CWnd *handletextu,BYTE velikost,char *jakyfont);
void NASTAV_VIDITELNOST_POZADI(BYTE refresh);
DWORD WINAPI VLAKNO__BLIKNUTI_S_NAPISEM_IQPOKYD(LPVOID lpParameter);
DWORD WINAPI VLAKNO__EFEKTY(LPVOID lpParameter);
DWORD WINAPI VLAKNO__HLASKY_A_OPERACE_NA_POZADI(LPVOID lpParameter);
DWORD WINAPI VLAKNO__PROCENTA_PROGRESU(LPVOID lpParameter);
DWORD WINAPI VLAKNO__NACITEJ_JAK_DIVEJ(LPVOID lpParameter);
void WINMFC_NACTI_SLOVNIKY(void);
void WINMFC_UVOLNI_VESKEROU_DYNAMICKOU_PAMET(void);
CString VRAT_NAZEV_MESICE(WORD mesic);
void ULOZ_KYDY(void);
void ULOZ_BINARNI_KYDY(void);
void ZOBRAZ_NAPOVEDU(void);
void PREKRESLI_OBRAZOVKU(void);
void ZMEN_POZICI_PRVKU(HWND objekt,int x,int y);
void ZMEN_VELIKOST_PRVKU(HWND objekt,int sirka,int vyska);
char *VRAT_ZALOMENY_TEXT_PRO_VYKRESLENI_NA_OBRAZOVKU(HDC hDc,HFONT hFont,CString text,int maxdelka_x,int vyska,int &pocetradku);
void PREFORMATUJ_TEXTY_CLOVEKA_A_POCITACE_NA_OBRAZOVCE(BYTE zmenavelikosti);
void PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI(int puvodni_x,int puvodni_y);
void JDI_NA_WWW_STRANKU(char *adresa);
void NAPIS_FORMATOVANY_TEXT_NAPOVEDY(char *formatovanytext,HWND policko);
