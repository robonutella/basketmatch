import { stores, products, offers } from "../data/catalog.js";
import { optimizeBasket } from "./engine.js";

const demoItems = [
  { id: crypto.randomUUID(), name: "milk", purchased: false },
  { id: crypto.randomUUID(), name: "eggs", purchased: false },
  { id: crypto.randomUUID(), name: "chicken breast", purchased: false },
  { id: crypto.randomUUID(), name: "strawberries", purchased: false },
  { id: crypto.randomUUID(), name: "Tide", purchased: false }
];

let state = {
  items: [...demoItems],
  includeRebates: true,
  verifiedOnly: true,
  maxStores: 2
};

const $ = selector => document.querySelector(selector);
const groceryList = $("#grocery-list");
const itemCount = $("#item-count");
const emptyState = $("#empty-state");
const results = $("#results");
const offerFeed = $("#offer-feed");
const heroSavings = $("#hero-savings");
const template = $("#grocery-item-template");

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function save() {
  localStorage.setItem("basketmatch-state", JSON.stringify(state));
}

function load() {
  try {
    const stored = JSON.parse(localStorage.getItem("basketmatch-state"));
    if (stored?.items) state = { ...state, ...stored };
  } catch {
    localStorage.removeItem("basketmatch-state");
  }
}

function renderItems() {
  groceryList.innerHTML = "";
  for (const item of state.items) {
    const node = template.content.cloneNode(true);
    const li = node.querySelector("li");
    const checkbox = node.querySelector(".item-checkbox");
    const name = node.querySelector(".item-name");
    const remove = node.querySelector(".remove-item");
    name.textContent = item.name;
    checkbox.checked = item.purchased;
    li.classList.toggle("purchased", item.purchased);
    checkbox.addEventListener("change", () => {
      item.purchased = checkbox.checked;
      save();
      render();
    });
    remove.addEventListener("click", () => {
      state.items = state.items.filter(candidate => candidate.id !== item.id);
      save();
      render();
    });
    groceryList.appendChild(node);
  }
  itemCount.textContent = `${state.items.length} item${state.items.length === 1 ? "" : "s"}`;
}

function renderResults() {
  const outcome = optimizeBasket({
    items: state.items,
    products,
    offers,
    stores,
    includeRebates: state.includeRebates,
    verifiedOnly: state.verifiedOnly,
    maxStores: state.maxStores
  });

  const plans = outcome.plans;
  emptyState.hidden = plans.length > 0;
  results.hidden = plans.length === 0;
  results.innerHTML = "";
  heroSavings.textContent = plans.length ? money(plans[0].savings) : money(0);

  plans.forEach((plan, index) => {
    const card = document.createElement("article");
    card.className = `result-card ${index === 0 ? "recommended" : ""}`;
    const storesLabel = plan.stores.map(store => store.name).join(" + ");
    card.innerHTML = `
      ${index === 0 ? '<span class="badge">Recommended</span>' : ""}
      <h3>${plan.label}</h3>
      <p class="subtle">${storesLabel}</p>
      <div class="total">${money(plan.netTotal)}</div>
      <div class="checkout">Pay now: ${money(plan.checkoutTotal)}</div>
      <ul>
        <li><span>Regular basket</span><strong>${money(plan.subtotal)}</strong></li>
        <li><span>Checkout savings</span><strong>−${money(plan.itemCheckoutDiscounts + plan.basketDiscount)}</strong></li>
        <li><span>Cashback</span><strong>−${money(plan.rebates)}</strong></li>
        <li><span>Total savings</span><strong>${money(plan.savings)}</strong></li>
      </ul>
      <details>
        <summary>View item plan</summary>
        <ul>${plan.lines.map(line => `<li><span>${line.product.name}</span><strong>${money(line.netPrice)}</strong></li>`).join("")}</ul>
      </details>
    `;
    results.appendChild(card);
  });

  offerFeed.innerHTML = "";
  if (!outcome.matchedOffers.length) {
    offerFeed.innerHTML = '<div class="empty-state">No eligible verified offers matched this basket.</div>';
  } else {
    for (const offer of outcome.matchedOffers) {
      const row = document.createElement("article");
      row.className = "offer";
      row.innerHTML = `
        <div>
          <h3>${offer.title}</h3>
          <div class="offer-meta">
            <span>${offer.provider}</span>
            <span>•</span>
            <span>${offer.sourceType}</span>
            <span>•</span>
            <span>${offer.redemptionMode === "rebate" ? "After purchase" : "At checkout"}</span>
            <span>•</span>
            <span>Expires ${offer.expiresAt}</span>
          </div>
        </div>
        <div class="confidence">${offer.confidence}%</div>
      `;
      offerFeed.appendChild(row);
    }
  }
}

function renderSuggestions() {
  const names = ["milk", "eggs", "chicken breast", "rice", "strawberries", "Tide"];
  const wrapper = $("#suggestions");
  wrapper.innerHTML = "";
  for (const name of names) {
    if (state.items.some(item => item.name.toLowerCase() === name.toLowerCase())) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = `+ ${name}`;
    button.addEventListener("click", () => addItem(name));
    wrapper.appendChild(button);
  }
}

function addItem(name) {
  const clean = name.trim();
  if (!clean) return;
  state.items.push({ id: crypto.randomUUID(), name: clean, purchased: false });
  save();
  render();
}

function render() {
  renderItems();
  renderSuggestions();
  renderResults();
  $("#rebate-toggle").checked = state.includeRebates;
  $("#verified-toggle").checked = state.verifiedOnly;
  $("#store-limit").value = String(state.maxStores);
}

$("#add-item-form").addEventListener("submit", event => {
  event.preventDefault();
  const input = $("#item-input");
  addItem(input.value);
  input.value = "";
  input.focus();
});

$("#rebate-toggle").addEventListener("change", event => {
  state.includeRebates = event.target.checked;
  save();
  renderResults();
});

$("#verified-toggle").addEventListener("change", event => {
  state.verifiedOnly = event.target.checked;
  save();
  renderResults();
});

$("#store-limit").addEventListener("change", event => {
  state.maxStores = Number(event.target.value);
  save();
  renderResults();
});

$("#recalculate").addEventListener("click", renderResults);
$("#demo-reset").addEventListener("click", () => {
  state = { items: demoItems.map(item => ({ ...item, id: crypto.randomUUID() })), includeRebates: true, verifiedOnly: true, maxStores: 2 };
  save();
  render();
});

load();
render();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
