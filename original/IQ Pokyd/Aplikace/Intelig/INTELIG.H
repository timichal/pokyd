/* Tento zdrojový kód je pod licencí GNU/GPL. Mùžete ho použít k vlastní
   potøebì, ale nesmíte jej ani programy založené na tomto kódu využít komerènì!

   Jedná se o zdrojový kód programu IQ Pokyd (http://iqpokyd.kyblsoft.cz)
   od Aleše Jandy
*/

/* IQ Pokyd - intelig.h - "háèkový" soubor pro funkce pro generování odpovìdi
   na základì vìty èlovìka a pøedchozích znalostí
   Aleš Janda (C) KÝBLSoft 2002-2005 (kódování Windows 1250)
*/

void PREVYGENERUJ_VLASTNISLOVO_U_TYP_SLOVA(Typ_slova trida,WORD pozice);
BYTE PODMINKA_NA_URCITY_TYP_SLOVA(Typ_slova atributy,Typ_slova vcemhledat,WORD poziceatributu);
BYTE VRAT_CISLO_ODPOVEDI_PODLE_HISTORIE(WORD pozicepodminky);
void VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE(void);
void POUZIJ_INTELIGENCI_IQPOKYDU(void);
char *POUZIJ_PRIMITIVNI_INTELIGENCI(void);
void ROZEBER_NEINTELIGENTNE_VETU(void);
int VRAT_PRIRUSTEK_NALADY_PODLE_CHARAKTERU(char prirustek,BYTE charakter);
BYTE PRICTI_PRIRUSTEK_K_NALADE(int pocatecninaladabody,int prirustek);
WORD NAJDI_SLOVO_PODLE_TYPU_V_IQ_PODMINCE(char *podminka,WORD &pozice,BYTE jedinyvyznam);
BYTE HODNOTA_JESTLI_PISE_CLOVEK_KRAVINY(void);
BYTE HODNOTA_JESTLI_JE_VETA_KLADNA(void);
BYTE VYHODNOT_ELEMENTARNI_STAROPOKYDOVSKOU_PODMINKU(char *podminka,WORD &posunoutpozici);
BYTE PRECTI_IQ_PODMINKU(char *podminka,WORD &posledninalezeneslovo,WORD &pozice);
void ODPOVEZ_PODLE_IQ_PODMINEK(void);
BYTE ZJISTI_SMYSL_VETY_POCITACE(char *odpoved);
void VYBER_Z_FRONTY_HOVOROVY_TVAR(Typ_slova trida);
