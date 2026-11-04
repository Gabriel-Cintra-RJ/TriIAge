// Ressalva de uso exigida em todas as telas de sugestão (Seção 1.4, RNF08).
export function UsageNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      <strong className="font-semibold text-foreground">Ferramenta de apoio.</strong>{" "}
      A classificação sugerida e as informações de bula não substituem a
      avaliação clínica. A decisão final é sempre da equipe de saúde
      responsável.
    </p>
  );
}
