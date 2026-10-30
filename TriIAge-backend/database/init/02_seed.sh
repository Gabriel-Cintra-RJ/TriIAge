#!/usr/bin/env bash
# Joga cada /seed/<tabela>.csv na tabela com o mesmo nome. A primeira linha do CSV tem que ser o
# cabeçalho com os nomes das colunas. Se o arquivo começar com número ("01_"), o número é ignorado;
# ele só serve para controlar a ordem quando uma tabela depende da outra.
# Cuidado: o Postgres carrega este script com "source", então nada de "exit" aqui dentro.

shopt -s nullglob
for csv in /seed/*.csv; do
    base=$(basename "$csv" .csv)
    table=${base#[0-9]*_}
    columns=$(head -n 1 "$csv" | tr -d '\r\n')
    columns=${columns#$'\xef\xbb\xbf'}  # tira o caractere invisível (BOM) que o Excel coloca no começo

    echo "seed: $csv -> $table ($columns)"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -c "\copy $table ($columns) FROM '$csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')"
done
