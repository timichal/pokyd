/* Tento zdrojový kód je pod licencí GNU/GPL. Můžete ho použít k vlastní
   potřebě, ale nesmíte jej ani programy založené na tomto kódu využít komerčně!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - slovnik.h - "háčkový" soubor pro funkce pro převod
   dosud neskloňovaného slovníku v textové podobě do binární podoby
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

BYTE SKLONUJ_JAKEKOLI_SLOVO(Typ_slova slova,WORD cisloslova);
FILE *OTEVRI_SOUBOR(char *nazev,char *jak);
void VRAT_SLOVO_ZE_ZAKLADNIHO_SLOVNIKU(WORD poziceslova);
WORD VRAT_POZICI_SLOVA_ZE_ZAKLADNIHO_SLOVNIKU(char *slovo,BYTE druhslova);
void ZAKODUJ_SLOVO_V_PAMETI(char *slovo);
void DEKODUJ_SLOVO_V_PAMETI(char *slovo);
int VRAT_CASTECNOU_HODNOTU_PROMENNE_AKTUALNIPISMENO(char znak);
void VRAT_HODNOTU_PROMENNE_AKTUALNIPISMENO(char znak);
void VRAT_HODNOTU_PROMENNE_AKTUALNIPISMENO(char znak1,char znak2,char znak3);
void ZAPIS_SLOVO_DO_SOUBORU_S_UPLNYM_SLOVNIKEM(char *slovo,char *puvodnislovo);
void ZAPIS_DO_UPLNEHO_SLOVNIKU_SLOVO(BYTE vynulovat);
void ZAPIS_DO_UPLNEHO_SLOVNIKU_FRONTU(void);
void VYNULUJ_HODNOTY_K_ROZSKLONOVANI(void);
BYTE VRAT_SLOVNI_DRUH(BYTE vzor);
void SKLONUJ_PODSTATNA_JMENA(BYTE vzor,BYTE pad,BYTE cislo);
BYTE SKLONUJ_PRIDAVNA_JMENA(BYTE vzor,BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE zapor,BYTE tvar,char *vyjimkavevnoreni);
BYTE SKLONUJ_ZAJMENA(BYTE vzor,BYTE osoba,BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE rodpredmetu,BYTE cislopredmetu,BYTE tvar,BYTE pridavek);
BYTE SKLONUJ_SLOVESA(BYTE vzor,BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar,char *predpona,char *vyjimkavevnoreni);
BYTE ROZPOZNEJ_VZOR_PODSTATNEHO_JMENA_PODLE_KONCOVKY(char *slovo,BYTE rod,BYTE zivotnost);
BYTE ROZPOZNEJ_VZOR_SLOVESA_PODLE_KONCOVKY(char *slovo);
BYTE ZJISTI_ZDA_JDE_O_VYJIMKU_SLOVA(char *ident_tvaru);
BYTE ZJISTI_ZDA_JDE_O_VYJIMKU_SLOVA(Typ_slova slova,WORD poziceslova);
BYTE ZJISTI_ZDA_JDE_O_VYJIMKU_SLOVA_VE_VNORENI(char *puvvnoreni,char *vnoreni);
inline char POROVNEJ_DVE_SLOVA(char *slovo1,char *slovo2);
void UVOLNI_VESKEROU_DYNAMICKOU_PAMET(void);
void PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU(void);
BYTE PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU(void);
void ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU(void);
void PRECTI_INTELIGENCI_ZE_SOUBORU(void);
BYTE PRECTI_PROFIL_ZE_SOUBORU(void);
void ZAPIS_PROFIL_DO_SOUBORU(void);
BYTE PRECTI_NASTAVENI_ZE_SOUBORU(void);
void ZAPIS_NASTAVENI_DO_SOUBORU(Nastaveni nast);
BYTE ZKONTROLUJ_SPRAVNY_OBSAH_SOUBORU_S_NAPOVEDOU(void);
void SETRID_SLOVA_V_DATABAZI(void);
char VRAT_BAJT_DO_IDENTIFIKACE_TVARU(char *retezec,BYTE promenna /* podle klicovych slov */,BYTE hodnota);
void ZAPIS_VNOROVANI(char znak);
void VYTVOR_IDENTIFIKACI_TVARU_SLOVA(BYTE vzor,DWORD id_slova,char *dodatky);
void ROZSKLONUJ_PODLE_SPRAVNEHO_VZORU(BYTE vzor,DWORD id_slova,BYTE uplnerozsklonovani,BYTE vid,BYTE rekurze);
void NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK(void);

