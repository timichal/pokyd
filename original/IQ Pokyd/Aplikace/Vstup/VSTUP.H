/* Tento zdrojový kód je pod licencí GNU/GPL. Mùžete ho použít k vlastní
   potøebì, ale nesmíte jej ani programy založené na tomto kódu využít komerènì!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - vstup.h - "háèkový" soubor pro funkce pro vstupní operace
   (pøeètení uživatelovy vìty)
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

BYTE JELI_ZNELA_SOUHLASKA(char znak);
char *HLEDEJ_SLOVO_S_PREDPONOU(char *slovo,char *predpona,char *predpona_s_e,char *nespisovnapredpona,BYTE atributy);
Typ_slova KOMPLETNE_VRAT_INFORMACE_O_SLOVU_Z_UPLNEHO_SLOVNIKU(char *hledaneslovo,BYTE atributy);
void VRAT_INFORMACE_O_SLOVU_Z_UPLNEHO_SLOVNIKU(char *hledaneslovo,BYTE atributy);
void VRAT_INFORMACE_O_SLOVU_S_TOLERANCI_Z_UPLNEHO_SLOVNIKU(char *slovo,int pozice,BYTE atributy,BYTE pocetrekurzi);
void PROCISTI_SLOVA_PODLE_ATRIBUTU(char *informace,BYTE atributy);
void VYMAZ_FRONTU_UPLNEHO_SLOVNIKU(void);
void POROZUMEJ_VETE_NAPSANE_CLOVEKEM(char *veta);
void ZPRACUJ_VETU(void);
WORD DOPLN_DO_TYP_SLOVA_ATRIBUTY_DANE_RETEZCEM(Typ_slova trida,WORD poziceslova,char *atributy);
void VYMAZ_NEPODSTATNE_ATRIBUTY_PRO_PREVOD_SLOVA(Typ_slova atributy,Typ_slova zcehovzniklo,WORD pozicevpuvodnim);
Typ_slova PREVED_NA_TRIDU_TYP_SLOVA(char *informace,BYTE dalsiatributy,char *predpona,BYTE binarniinformace);
char *PREVED_Z_TRIDY_TYP_SLOVA_NA_RETEZEC(Typ_slova slovo,WORD poziceslova);
void ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA(void);
void VYNULUJ_VSECHNY_PRVKY_G_VETACLOVEKA(void);
void PREVED_Z_LATIN_2_NA_WINDOWS_1250(char *slovo);
void PREVED_Z_WINDOWS_1250_NA_LATIN_2(char *slovo);
void NAPIS_TEXT_V_LATIN_2(char *text);
void PRIDEJ_PRED_ZAKLADNI_TVAR_PREDPONU(char *predpona);
BYTE POROVNEJ_DVA_ATRIBUTY_Z_TYPU_SLOVA(BYTE atribut1,BYTE atribut2);
BYTE POROVNEJ_DVA_ID_SLOVA_Z_TYPU_SLOVA(WORD atribut1,WORD atribut2);
BYTE URCITE_POROVNEJ_DVA_ATRIBUTY_Z_TYPU_SLOVA(BYTE atribut1,BYTE atribut2);
BYTE POROVNEJ_VNORENI_Z_TYPU_SLOVA(char *vnoreni1,char *vnoreni2);
BYTE POROVNEJ_MNOZINU_ATRIBUTU_Z_TYPU_SLOVA(WORD pocetslov2,BYTE atribut1A,BYTE *atributy1B);
BYTE POROVNEJ_MNOZINU_ATRIBUTU_Z_TYPU_SLOVA(WORD pocetslov2,BYTE atribut1A,BYTE *atributy1B,BYTE atribut2A,BYTE *atributy2B);
BYTE POROVNEJ_MNOZINU_ATRIBUTU_Z_TYPU_SLOVA(WORD pocetslov2,BYTE atribut1A,BYTE *atributy1B,BYTE atribut2A,BYTE *atributy2B,BYTE atribut3A,BYTE *atributy3B);
BYTE POROVNEJ_MNOZINU_ATRIBUTU_Z_TYPU_SLOVA(WORD pocetslov2,BYTE atribut1A,BYTE *atributy1B,BYTE atribut2A,BYTE *atributy2B,BYTE atribut3A,BYTE *atributy3B,BYTE atribut4A,BYTE *atributy4B);
BYTE POROVNEJ_MNOZINU_ATRIBUTU_Z_TYPU_SLOVA(WORD pocetslov2,BYTE atribut1A,BYTE *atributy1B,BYTE atribut2A,BYTE *atributy2B,BYTE atribut3A,BYTE *atributy3B,BYTE atribut4A,BYTE *atributy4B,BYTE atribut5A,BYTE *atributy5B);
BYTE PROTRID_SLOVA_DLE_JINEHO_SLOVA_S_ATRIBUTY(Typ_slova slova1,WORD pocetslov1,WORD pocetslov2,BYTE *atributy1A,BYTE *atributy1B);
BYTE PROTRID_SLOVA_DLE_JINEHO_SLOVA_S_ATRIBUTY(Typ_slova slova1,WORD pocetslov1,WORD pocetslov2,BYTE *atributy1A,BYTE *atributy1B,BYTE *atributy2A,BYTE *atributy2B);
BYTE PROTRID_SLOVA_DLE_JINEHO_SLOVA_S_ATRIBUTY(Typ_slova slova1,WORD pocetslov1,WORD pocetslov2,BYTE *atributy1A,BYTE *atributy1B,BYTE *atributy2A,BYTE *atributy2B,BYTE *atributy3A,BYTE *atributy3B);
BYTE PROTRID_SLOVA_DLE_JINEHO_SLOVA_S_ATRIBUTY(Typ_slova slova1,WORD pocetslov1,WORD pocetslov2,BYTE *atributy1A,BYTE *atributy1B,BYTE *atributy2A,BYTE *atributy2B,BYTE *atributy3A,BYTE *atributy3B,BYTE *atributy4A,BYTE *atributy4B);
BYTE PROTRID_SLOVA_DLE_JINEHO_SLOVA_S_ATRIBUTY(Typ_slova slova1,WORD pocetslov1,WORD pocetslov2,BYTE *atributy1A,BYTE *atributy1B,BYTE *atributy2A,BYTE *atributy2B,BYTE *atributy3A,BYTE *atributy3B,BYTE *atributy4A,BYTE *atributy4B,BYTE *atributy5A,BYTE *atributy5B);
char *X_PROTRID_SLOVA_DLE_JINEHO_SLOVA_S_ATRIBUTY(WORD pocetslov1,WORD pocetslov2,BYTE *atributy1,BYTE *atributy2);
void DOPLN_ATRIBUTY_TYPU_SLOVA(BYTE &atribut1,BYTE &atribut2);

