import type { Offer } from "@basketmatch/domain";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useBasket } from "@/components/BasketProvider";
import { Card, colors, Eyebrow, uiStyles } from "@/components/ui";
import { demoOffers } from "@/lib/demo";
import { formatCents, formatStatus } from "@/lib/format";

const allStatuses = [
  "verified",
  "recently_redeemed",
  "unverified",
  "failed",
  "expired",
] as const;

export default function OffersScreen() {
  const { outcome, verifiedOnly } = useBasket();
  const matchedIds = new Set(outcome.matchedOffers.map((offer) => offer.id));

  return (
    <ScrollView contentContainerStyle={uiStyles.content} style={uiStyles.screen}>
      <View style={styles.intro}>
        <Eyebrow>Transparency</Eyebrow>
        <Text style={uiStyles.heading}>Offer wallet</Text>
        <Text style={uiStyles.body}>
          Trusted mode counts offers marked verified or recently redeemed. Demo status labels are
          fixture data, not live provider evidence. “Matched” means the demo engine selected the
          offer for at least one visible plan.
        </Text>
      </View>

      {!verifiedOnly && (
        <View accessibilityRole="alert" style={styles.exploratoryNotice}>
          <Text style={styles.exploratoryText}>
            Exploratory mode is on. Matched unverified offers are scenarios, not guarantees.
          </Text>
        </View>
      )}

      <View accessibilityLabel="Offer status legend" style={styles.legend}>
        {allStatuses.map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: statusColor(status) }]} />
            <Text style={styles.legendLabel}>{formatStatus(status)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.list}>
        {demoOffers.map((offer) => (
          <OfferCard key={offer.id} matched={matchedIds.has(offer.id)} offer={offer} />
        ))}
      </View>
    </ScrollView>
  );
}

function OfferCard({ offer, matched }: { offer: Offer; matched: boolean }) {
  return (
    <Card>
      <View style={styles.offerTop}>
        <View style={styles.offerCopy}>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          <Text style={styles.provider}>{offer.provider}</Text>
        </View>
        {matched && <Text style={styles.matched}>Matched</Text>}
      </View>
      <View style={styles.offerMeta}>
        <Text style={[styles.status, { color: statusColor(offer.status) }]}>
          ● {formatStatus(offer.status)}
        </Text>
        <Text style={styles.meta}>{offerValue(offer)}</Text>
        <Text style={styles.meta}>
          {offer.redemptionMode === "rebate" ? "After purchase" : "At checkout"}
        </Text>
      </View>
      <Text style={styles.expiry}>Expires {String(offer.expiresAt)}</Text>
    </Card>
  );
}

function offerValue(offer: Offer): string {
  if (offer.amountOffCents) return `${formatCents(offer.amountOffCents)} off`;
  if (offer.percentOffBasisPoints) return `${offer.percentOffBasisPoints / 100}% off`;
  return "Eligibility-based offer";
}

function statusColor(status: string): string {
  switch (status) {
    case "verified":
      return "#2c8a63";
    case "recently_redeemed":
      return "#aa7411";
    case "failed":
      return colors.danger;
    case "expired":
      return "#786f67";
    default:
      return "#8a918d";
  }
}

const styles = StyleSheet.create({
  intro: { gap: 5, paddingHorizontal: 3 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 3 },
  exploratoryNotice: {
    backgroundColor: "#fff6dc",
    borderColor: "#e8b44f",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  exploratoryText: { color: "#76500c", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 6 },
  dot: { borderRadius: 99, height: 8, width: 8 },
  legendLabel: { color: colors.muted, fontSize: 12 },
  list: { gap: 11 },
  offerTop: { alignItems: "flex-start", flexDirection: "row", gap: 10 },
  offerCopy: { flex: 1, gap: 3 },
  offerTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  provider: { color: colors.muted, fontSize: 13 },
  matched: {
    backgroundColor: "#ecf5f0",
    borderRadius: 999,
    color: colors.brand2,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  offerMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  status: { fontSize: 12, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12 },
  expiry: { color: colors.muted, fontSize: 12, marginTop: 8 },
});
