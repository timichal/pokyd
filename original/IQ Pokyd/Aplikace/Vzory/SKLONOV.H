/* Tento zdrojový kód je pod licencí GNU/GPL. Mùžete ho použít k vlastní
   potøebì, ale nesmíte jej ani programy založené na tomto kódu využít komerènì!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - sklonov.h - hlavièky funkcí potøebné pro skloòování slovních
   druhù
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

void UPRAV_DLOUHE_SLOVO_PRO_IQPOKYD(char *retezec);
void UPRAV_SLOVO_PRO_IQPOKYD(char *retezec);
void UPRAV_SLOVO_PRO_IQPOKYD(char *retezec,BYTE dlouhe);
void ODUPRAV_DLOUHE_SLOVO_PRO_IQPOKYD(char *retezec);
void ODUPRAV_SLOVO_PRO_IQPOKYD(char *retezec);
void ODUPRAV_SLOVO_PRO_IQPOKYD(char *retezec,BYTE dlouhe);
void PROVED_KOREKCI_U_SLOVA_PRO_IQPOKYD(char *retezec);
BYTE ZAMEN_SLOVA_VE_VETE_PRO_IQPOKYD(char *zdroj,char *vysledek,char *slovo,char *cimnahradit,int &pozicezdroj,int &pozicevysledek);
char *UPRAV_VETU_PRO_IQPOKYD(char *retezec);
void ODUPRAV_VETU_PRO_IQPOKYD(void);
void VYMAZ_FRONTU(void);
void VYMAZ_FRONTU_UPLNEHO_SLOVNIKU(void);
void PRIDEJ_DO_FRONTY(void);
void PRIDEJ_DO_FRONTY(char *co);
void POMOCNE_SLOVESO(BYTE jake /* podle klicovych slov */,BYTE zapor);
void PRIDEJ_DO_PRECHODNE_FRONTY(char *kam,char *co);
void PRIDEJ_NA_ZACATEK_FRONTY(void);
void PRIDEJ_NA_ZACATEK_FRONTY(char *co);
void PRIDEJ_NA_KONEC(char *co);
void PRIDEJ_NA_ZACATEK(char *co);
BYTE OREZ_FRONTU_NA_1_SLOVO(int kolikate);
BYTE OREZ_FRONTU_NA_1_SLOVO(char *fronta,int kolikate);
BYTE ZJEMNI_ZNAK(char *retezec,int pozice);
BYTE ZJEMNI_SLOVO_PODSTJM(void);
BYTE PODM_ZKRAT_SAMOHLASKU_ODZADU(char *retezec,int kolikatou,BYTE co_kontrolovat);
BYTE MEKKA_SOUHLASKA(char pismeno);
BYTE TVRDA_SOUHLASKA(char pismeno);
char POSLEDNI_ZNAK(char *retezec);
char PREDPOSLEDNI_ZNAK(char *retezec);
char PREDPREDPOSLEDNI_ZNAK(char *retezec);
BYTE POSLEDNI_PISMENA(char *retezec,char *hledane);
BYTE JELI_PISMENO(char pismeno);
BYTE JELI_SAMOHLASKA(char pismeno);
BYTE JELI_SOUHLASKA(char pismeno);
BYTE JELI_MALE_PISMENO(char znak);
BYTE JELI_VELKE_PISMENO(char znak);
char VRAT_MALE_PISMENO(char znak);
char VRAT_VELKE_PISMENO(char znak);
void PREVED_NA_MALA_PISMENA(char *slovo);
BYTE POROVNEJ_DVA_RETEZCE(char *text1,char *text2);
BYTE POROVNEJ_DVA_RETEZCE(char *text1,char *text2,WORD kolik);
WORD POCET_SLABIK(char *retezec);
BYTE MALI_KONCOVKA_SLABIKU(char *retezec);
BYTE OREZ_O_SAMOHLASKU(char *retezec);
BYTE OREZ_POSLEDNI_ZNAKY(char *retezec,BYTE kolik);
void ODSTRAN_E(char *retezec);
void PODM_ODSTRAN_E(char *retezec);
void PODM_ODSTRAN_E_C(char *retezec);
BYTE PODM_VLOZ_E(char *retezec,BYTE co_kontrolovat,BYTE vlozenie);
BYTE PODM_ODSTRAN_US(char *retezec,BYTE co_kontrolovat,BYTE koncovkaus);
BYTE PODM_ODSTRAN_UM(char *retezec,BYTE koncovkaum);
void ZMEN_PREDPOSLEDNI_U_NA_O(char *retezec);
void PRIDEJ_PRED_KAZDE_SLOVO(char *co);
void PRIDEJ_ZA_KAZDE_SLOVO(char *co);
BYTE ZJEMNI_KONCOVKU_PRIDJM(void);
BYTE ZJEMNI_KONCOVKU_SLOVESA_1(void);
char ZJEMNI_KONCOVKU_SLOVESA_2(char znak);
BYTE ZDRSNI_KONCOVKU_SLOVESA(void);
char ZKRAT_SAMOHLASKU(char pismeno);
char PRODLUZ_SAMOHLASKU(char pismeno);
BYTE PRODLUZ_PREDPOSLEDNI_SAMOHLASKU_V_SLOVESE(char *retezec);
BYTE ZKRAT_PREDPOSLEDNI_SAMOHLASKU_V_SLOVESE(char *retezec,BYTE zmena_i_na_e);
char *VRAT_5_PAD_Z_RETEZCE(char *jmenozaklad,BYTE rod);
void VYGENERUJ_TVAR_DELANY(char *odkud);
void NAHRAD_CAST_CASTI(char *cast, char *cim);
void NAHRAD_ZACATEK_ZACATKEM(char *cast, char *cim);
void PRIDEJ_ZA_KAZDE_SLOVO_JEDNOTLIVA_SLOVA(char *kam, char *cim);
void SKLONUJ_VSECHNY_CISLOVKY(char *slovavefronte2,char *koncovka,WORD cislovka,BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost);
void PRIDEJ_SE_SPRAVNOU_KONCOVKOU_SLOVESA(BYTE rod,BYTE cislo,BYTE zivotnost);
void DOPLN_POMOCNE_SLOVESO(BYTE osoba,BYTE cislo,BYTE cas,BYTE vid,BYTE zapor);
void PRIDEJ_S_KONCOVKOU_ROZKAZOVACIHO_SLOVESA(BYTE osoba,BYTE cislo,BYTE zapor);
void *ALOKUJ_PAMET(DWORD velikost);
char *ALOKUJ_RETEZEC(DWORD velikost);
char **ALOKUJ_POINTERY(DWORD velikost);
void *PREALOKUJ_PAMET(void *pointer,DWORD velikost);
void *REALOKUJ_PAMET(void *pointer,DWORD velikost);
void UVOLNI_X(void *pointer);

void SKLONUJ_VZOR_PAN(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_HRAD(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_MUZ(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_STROJ(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_PREDSEDA(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_SOUDCE(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_ZENA(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_RUZE(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_PISEN(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_KOST(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_MESTO(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_MORE(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_KURE(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_STAVENI(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_RONY(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_IDEA(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_TEMA(BYTE pad,BYTE cislo);
void SKLONUJ_VZOR_KALHOTY(BYTE pad);
void SKLONUJ_VZOR_DATA(BYTE pad);
void SKLONUJ_VZOR_HOUSLE(BYTE pad);
void SKLONUJ_VZOR_KUPE(void);


BYTE SKLONUJ_VZOR_MLADY(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE SKLONUJ_VZOR_JARNI(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE zapor,BYTE tvar);
void SKLONUJ_VZOR_MATCIN(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost);
void SKLONUJ_VZOR_OTCUV(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost);
void SKLONUJ_VZOR_SUPER(void);
BYTE VYTVOR_JMENNY_TVAR(void);
BYTE SKLONUJ_JMENNY_TVAR(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE zapor);


BYTE SKLONUJ_ZAJMENA_OSOBNI(BYTE osoba,BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE umisteni);
BYTE SKLONUJ_ZAJMENA_PRIVLASTNOVACI(BYTE osoba,BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE rodpredmetu,BYTE cislopredmetu);
void SKLONUJ_ZAJMENA_UKAZOVACI(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE tvar);
void SKLONUJ_ZAJMENA_TAZACI(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE tvar);
void SKLONUJ_ZAJMENA_VZTAZNA(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE umisteni,BYTE tvar);
BYTE SKLONUJ_ZAJMENA_NEURCITA(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE tvar,BYTE pridavek);
void SKLONUJ_ZAJMENA_ZAPORNA(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,BYTE tvar);


BYTE SKLONUJ_CISLOVKY_ZAKLADNI(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,WORD cislovka,BYTE spredmetem);
BYTE SKLONUJ_CISLOVKY_RADOVE(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,WORD cislovka);
BYTE SKLONUJ_CISLOVKY_DRUHOVE(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,WORD cislovka,BYTE jmennytvar);
BYTE SKLONUJ_CISLOVKY_NASOBNE(BYTE pad,BYTE cislo,BYTE rod,BYTE zivotnost,WORD cislovka,BYTE tvar);
BYTE SKLONUJ_CISLA(BYTE pad,BYTE cislo,WORD cislovka);
BYTE SKLONUJ_CISLA_ZLOMKU(BYTE pad,BYTE cislo,WORD cislovka);


BYTE CASUJ_VZOR_NESE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_BERE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_MAZE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_PECE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_UMRE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_TISKNE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_MINE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_ZACNE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_KRYJE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_KUPUJE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_PROSI(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_TRPI(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_SAZI(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_VZOR_DELA(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE vid,BYTE zivotnost,BYTE zapor,BYTE tvar);
BYTE CASUJ_SLOVESO_JE(BYTE osoba,BYTE cislo,BYTE cas,BYTE rod,BYTE zivotnost,BYTE zapor,BYTE tvar);


BYTE VYGENERUJ_PRISLOVCE_Z_PRIDAVNEHO_JMENA(void);

