import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useBasket } from "@/components/BasketProvider";
import {
  Card,
  colors,
  Eyebrow,
  PillButton,
  SectionTitle,
  ToggleRow,
  uiStyles,
} from "@/components/ui";
import { DEMO_SUGGESTIONS } from "@/lib/demo";
import { formatCents } from "@/lib/format";

export default function BasketScreen() {
  const router = useRouter();
  const {
    items,
    addItem,
    removeItem,
    togglePurchased,
    includeRebates,
    setIncludeRebates,
    verifiedOnly,
    setVerifiedOnly,
    maxStores,
    setMaxStores,
    outcome,
    reset,
  } = useBasket();
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(
    () =>
      DEMO_SUGGESTIONS.filter(
        (suggestion) =>
          !items.some((item) => item.name.toLowerCase() === suggestion.toLowerCase()),
      ),
    [items],
  );

  const recommended = outcome.plans[0];

  function submitItem() {
    addItem(draft);
    setDraft("");
  }

  return (
    <ScrollView
      contentContainerStyle={uiStyles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={uiStyles.screen}
    >
      <View style={styles.topRow}>
        <View>
          <Eyebrow>
            {verifiedOnly ? "Verified grocery savings" : "Unverified offer exploration"}
          </Eyebrow>
          <Text style={styles.brandTitle}>BasketMatch</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={reset} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset demo</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Eyebrow light>{verifiedOnly ? "Build your basket once" : "Exploratory scenario"}</Eyebrow>
          <Text style={styles.heroTitle}>
            {verifiedOnly
              ? "Find the lowest verified grocery total."
              : "Explore totals that may include unverified offers."}
          </Text>
          <Text style={styles.heroBody}>
            {verifiedOnly
              ? "Store pricing, legitimate coupons, promos, and post-purchase rebates in one plan."
              : "These scenarios are not trusted recommendations or checkout guarantees."}
          </Text>
        </View>
        <View style={styles.savingsBox}>
          <Text style={styles.savingsLabel}>
            {verifiedOnly ? "Potential savings" : "Exploratory savings"}
          </Text>
          <Text style={styles.savingsValue}>
            {formatCents(recommended?.savingsCents ?? 0)}
          </Text>
        </View>
      </View>

      <Card>
        <SectionTitle
          eyebrow="Step 1"
          title="Your grocery list"
          trailing={<Text style={styles.countPill}>{items.length} items</Text>}
        />
        <View style={styles.addRow}>
          <TextInput
            accessibilityLabel="Add a grocery item"
            autoCapitalize="sentences"
            onChangeText={setDraft}
            onSubmitEditing={submitItem}
            placeholder="Try milk, eggs, Tide…"
            placeholderTextColor="#89938e"
            returnKeyType="done"
            style={styles.input}
            value={draft}
          />
          <Pressable accessibilityRole="button" onPress={submitItem} style={styles.addButton}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {suggestions.length > 0 && (
          <View accessibilityLabel="Suggested grocery items" style={styles.chipRow}>
            {suggestions.map((suggestion) => (
              <PillButton key={suggestion} onPress={() => addItem(suggestion)}>
                + {suggestion}
              </PillButton>
            ))}
          </View>
        )}

        <View style={styles.list}>
          {items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Pressable
                accessibilityLabel={`${item.purchased ? "Uncheck" : "Check off"} ${item.name}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.purchased }}
                onPress={() => togglePurchased(item.id)}
                style={styles.itemLabel}
              >
                <View style={[styles.checkbox, item.purchased && styles.checkboxChecked]}>
                  {item.purchased && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.itemName, item.purchased && styles.itemPurchased]}>
                  {item.name}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={`Remove ${item.name}`}
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => removeItem(item.id)}
              >
                <Text style={styles.remove}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="Step 2" title="Offer controls" />
        <ToggleRow
          description="Keep checkout cost distinct from later cashback."
          label="Include post-purchase rebates"
          onValueChange={setIncludeRebates}
          value={includeRebates}
        />
        <ToggleRow
          description="Count only offers marked verified or recently redeemed."
          label="Only count trusted-status offers"
          onValueChange={setVerifiedOnly}
          value={verifiedOnly}
        />
        {!verifiedOnly && (
          <View accessibilityRole="alert" style={styles.exploratoryNotice}>
            <Text style={styles.exploratoryTitle}>Exploratory scenario</Text>
            <Text style={styles.exploratoryBody}>
              Unverified offers may affect these totals. Do not treat them as a recommendation or
              checkout guarantee.
            </Text>
          </View>
        )}
        <Text style={styles.controlLabel}>Maximum stores</Text>
        <View style={styles.chipRow}>
          {[1, 2, 3].map((limit) => (
            <PillButton
              key={limit}
              accessibilityLabel={`Use up to ${limit} ${limit === 1 ? "store" : "stores"}`}
              onPress={() => setMaxStores(limit)}
              selected={maxStores === limit}
            >
              {limit === 1 ? "One store" : `Up to ${limit}`}
            </PillButton>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle
          eyebrow={verifiedOnly ? "Step 3" : "Unverified scenario"}
          title={verifiedOnly ? "Best trusted basket plans" : "Exploratory basket plans"}
        />
        {outcome.plans.length === 0 ? (
          <Text style={styles.empty}>Add an active item to compare grocery totals.</Text>
        ) : (
          <View style={styles.planList}>
            {outcome.plans.map((plan, index) => (
              <Pressable
                accessibilityHint="Opens the item plan and calculation trace"
                accessibilityRole="button"
                key={`${plan.label}-${index}`}
                onPress={() =>
                  router.push({ pathname: "/plan/[index]", params: { index: String(index) } })
                }
                style={[styles.plan, index === 0 && styles.recommendedPlan]}
              >
                {index === 0 && (
                  <Text style={styles.badge}>
                    {verifiedOnly ? "Recommended" : "Exploratory · unverified"}
                  </Text>
                )}
                <Text style={styles.planTitle}>{plan.label}</Text>
                <Text style={styles.planStores}>
                  {plan.stores.map((store) => store.name).join(" + ")}
                </Text>
                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>Net after rebates</Text>
                    <Text style={styles.netTotal}>{formatCents(plan.netTotalCents)}</Text>
                  </View>
                  <View style={styles.checkoutColumn}>
                    <Text style={styles.totalLabel}>Pay at checkout</Text>
                    <Text style={styles.checkoutTotal}>
                      {formatCents(plan.checkoutTotalCents)}
                    </Text>
                  </View>
                </View>
                <View style={styles.metrics}>
                  <Metric label="Regular basket" value={formatCents(plan.subtotalCents)} />
                  <Metric
                    label="Checkout savings"
                    value={`−${formatCents(
                      plan.itemCheckoutDiscountsCents + plan.basketDiscountCents,
                    )}`}
                  />
                  <Metric label="Cashback later" value={`−${formatCents(plan.rebateTotalCents)}`} />
                </View>
                <Text style={styles.traceLink}>View item plan and trace →</Text>
              </Pressable>
            ))}
          </View>
        )}

        {outcome.unmatched.length > 0 && (
          <Text style={styles.unmatched}>No exact demo match: {outcome.unmatched.join(", ")}</Text>
        )}
      </Card>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  brandTitle: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  resetButton: {
    backgroundColor: "rgba(18,55,42,0.08)",
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  resetText: { color: colors.brand, fontSize: 13, fontWeight: "800" },
  hero: {
    backgroundColor: colors.brand,
    borderRadius: 24,
    gap: 18,
    padding: 22,
  },
  heroCopy: { gap: 5 },
  heroTitle: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -1.2,
    lineHeight: 37,
  },
  heroBody: { color: "rgba(255,255,255,0.76)", fontSize: 15, lineHeight: 22 },
  savingsBox: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    padding: 16,
  },
  savingsLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  savingsValue: { color: colors.white, fontSize: 28, fontWeight: "900", marginTop: 4 },
  countPill: {
    backgroundColor: "#eef1eb",
    borderRadius: 999,
    color: colors.brand2,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addRow: { flexDirection: "row", gap: 9 },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 17,
  },
  addButtonText: { color: colors.white, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  list: { gap: 8, marginTop: 14 },
  itemRow: {
    alignItems: "center",
    backgroundColor: "#f7f5ee",
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  itemLabel: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10 },
  checkbox: {
    alignItems: "center",
    borderColor: colors.line,
    borderRadius: 5,
    borderWidth: 2,
    height: 21,
    justifyContent: "center",
    width: 21,
  },
  checkboxChecked: { backgroundColor: colors.brand2, borderColor: colors.brand2 },
  checkmark: { color: colors.white, fontSize: 13, fontWeight: "900" },
  itemName: { color: colors.ink, flex: 1, fontSize: 15, fontWeight: "700" },
  itemPurchased: { color: colors.muted, textDecorationLine: "line-through" },
  remove: { color: colors.danger, fontSize: 27, lineHeight: 27, paddingHorizontal: 5 },
  controlLabel: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 16 },
  exploratoryNotice: {
    backgroundColor: "#fff6dc",
    borderColor: "#e8b44f",
    borderRadius: 14,
    borderWidth: 1,
    gap: 3,
    marginTop: 14,
    padding: 12,
  },
  exploratoryTitle: { color: "#76500c", fontSize: 13, fontWeight: "900" },
  exploratoryBody: { color: "#76500c", fontSize: 12, lineHeight: 18 },
  empty: {
    borderColor: colors.line,
    borderRadius: 17,
    borderStyle: "dashed",
    borderWidth: 1,
    color: colors.muted,
    padding: 30,
    textAlign: "center",
  },
  planList: { gap: 12 },
  plan: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    padding: 17,
  },
  recommendedPlan: { borderColor: colors.brand2, borderWidth: 2 },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#ecf5f0",
    borderRadius: 999,
    color: colors.brand2,
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  planTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  planStores: { color: colors.muted, fontSize: 13, marginTop: 3 },
  totalRow: { alignItems: "flex-end", flexDirection: "row", gap: 12, marginTop: 15 },
  totalLabel: { color: colors.muted, fontSize: 11, textTransform: "uppercase" },
  netTotal: { color: colors.ink, fontSize: 29, fontWeight: "900", letterSpacing: -0.8 },
  checkoutColumn: { alignItems: "flex-end", flex: 1 },
  checkoutTotal: { color: colors.ink, fontSize: 17, fontWeight: "800", marginTop: 2 },
  metrics: { borderTopColor: colors.line, borderTopWidth: 1, gap: 7, marginTop: 14, paddingTop: 12 },
  metricRow: { flexDirection: "row", justifyContent: "space-between" },
  metricLabel: { color: colors.muted, fontSize: 13 },
  metricValue: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  traceLink: { color: colors.brand2, fontSize: 13, fontWeight: "800", marginTop: 14 },
  unmatched: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 14 },
});
