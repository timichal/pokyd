#include <stdio.h>
#include <string.h>
#include <stdlib.h>

FILE *vstup,*vystup;
int znakint;
unsigned char znak;
unsigned long delka,pozice;

void main(void) {
if ((vstup=fopen("zdroj.ch","rb")) == NULL) { printf("Nelze otevrit soubor ZDROJ.CH!"); exit(1); }
if ((vystup=fopen("cheat.fu","w")) == NULL) { printf("Nelze otevrit soubor CHEAT.FU!"); exit(1); }

fseek(vstup,0,SEEK_END); delka=ftell(vstup); fseek(vstup,0,SEEK_SET);

fprintf(vystup,"char *VRAT_TEXT_CHEATU_MISA(void) {\n  return(\"");

for (pozice=0; (znakint=getc(vstup)) != EOF; pozice++) {
  znak=znakint;
  znak^=128;
  fprintf(vystup,"\\x%02X",znak);
  if ((pozice%20) == 19) fprintf(vystup,"\"\n  \"");  //novy radek
 }

fprintf(vystup,"\");\n }\n");

fclose(vystup); fclose(vstup);
}