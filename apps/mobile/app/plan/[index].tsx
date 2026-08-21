import { useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useBasket } from "@/components/BasketProvider";
import { Card, colors, Eyebrow, SectionTitle, uiStyles } from "@/components/ui";
import { describeTraceEntry, formatCents, readCents } from "@/lib/format";

export default function PlanDetailScreen() {
  const params = useLocalSearchParams<{ index?: string | string[] }>();
  const rawIndex = Array.isArray(params.index) ? params.index[0] : params.index;
  const planIndex = Number.parseInt(rawIndex ?? "0", 10);
  const { outcome, verifiedOnly } = useBasket();
  const plan = outcome.plans[Number.isFinite(planIndex) ? planIndex : 0];

  if (!plan) {
    return (
      <View style={[uiStyles.screen, styles.center]}>
        <Text style={uiStyles.heading}>Basket plan unavailable</Text>
        <Text style={uiStyles.body}>Return to the basket and recalculate the demo.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={uiStyles.content} style={uiStyles.screen}>
      <View style={styles.intro}>
        <Eyebrow>{verifiedOnly ? "Recommended route" : "Unverified exploratory route"}</Eyebrow>
        <Text style={uiStyles.heading}>{plan.label}</Text>
        <Text style={uiStyles.body}>{plan.stores.map((store) => store.name).join(" + ")}</Text>
        {!verifiedOnly && (
          <Text style={styles.exploratoryText}>
            This scenario may include unverified offers and is not a checkout guarantee.
          </Text>
        )}
      </View>

      <Card style={styles.summary}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Pay at checkout</Text>
            <Text style={styles.checkout}>{formatCents(plan.checkoutTotalCents)}</Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.summaryLabel}>Net after rebates</Text>
            <Text style={styles.net}>{formatCents(plan.netTotalCents)}</Text>
          </View>
        </View>
        <Text style={styles.rebateNote}>
          Cashback later: {formatCents(plan.rebateTotalCents)}. It is never subtracted from the
          amount due at checkout.
        </Text>
      </Card>

      <Card>
        <SectionTitle eyebrow="Exact matches" title="Item plan" />
        <View style={styles.lines}>
          {plan.lines.map((line, index) => (
            <View key={`${line.product.id}-${index}`} style={styles.line}>
              <View style={styles.lineCopy}>
                <Text style={styles.product}>{line.product.name}</Text>
                <Text style={styles.store}>
                  {plan.stores.find((store) => store.id === line.product.storeId)?.name ??
                    line.product.storeId}
                </Text>
              </View>
              <Text style={styles.linePrice}>{formatCents(readCents(line, "netPriceCents"))}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="Explainability" title="Calculation trace" />
        {plan.calculationTrace.length === 0 ? (
          <Text style={uiStyles.body}>No offer decisions were required for this plan.</Text>
        ) : (
          <View style={styles.trace}>
            {plan.calculationTrace.map((entry, index) => (
              <View key={index} style={styles.traceRow}>
                <Text style={styles.traceIndex}>{index + 1}</Text>
                <Text style={styles.traceText}>{describeTraceEntry(entry)}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  intro: { gap: 3, paddingHorizontal: 3 },
  exploratoryText: { color: "#8a5b08", fontSize: 13, fontWeight: "700", lineHeight: 19 },
  summary: { backgroundColor: colors.brand },
  summaryRow: { alignItems: "flex-end", flexDirection: "row", gap: 16 },
  summaryLabel: { color: "rgba(255,255,255,0.66)", fontSize: 11, textTransform: "uppercase" },
  checkout: { color: colors.white, fontSize: 24, fontWeight: "800", marginTop: 3 },
  right: { alignItems: "flex-end", flex: 1 },
  net: { color: colors.accent, fontSize: 29, fontWeight: "900", marginTop: 3 },
  rebateNote: {
    borderTopColor: "rgba(255,255,255,0.16)",
    borderTopWidth: 1,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    paddingTop: 12,
  },
  lines: { gap: 12 },
  line: { alignItems: "center", flexDirection: "row", gap: 12 },
  lineCopy: { flex: 1 },
  product: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  store: { color: colors.muted, fontSize: 12, marginTop: 2 },
  linePrice: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  trace: { gap: 12 },
  traceRow: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  traceIndex: {
    backgroundColor: "#eef1eb",
    borderRadius: 99,
    color: colors.brand2,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  traceText: { color: colors.ink, flex: 1, fontSize: 13, lineHeight: 19, paddingTop: 3 },
});
