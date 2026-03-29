import { GoogleGenerativeAI } from "@google/generative-ai";
import { Dish } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function getAIPairingSuggestion(dish: Dish, allDishes: Dish[]) {
  // 1. GATHER ALL DRINKS (Broad Search)
  const allDrinks = allDishes.filter(d => 
    d.category?.toLowerCase().includes('drink') || 
    d.subcategory?.toLowerCase().includes('drink') ||
    d.subcategory?.toLowerCase().includes('mocktail') ||
    d.subcategory?.toLowerCase().includes('shake') ||
    d.subcategory?.toLowerCase().includes('soda') ||
    d.subcategory?.toLowerCase().includes('water')
  );

  // 2. EMERGENCY FALLBACK (If AI fails or no match found)
  const defaultSuggestion = allDrinks.length > 0 
    ? { suggestedDrinkName: allDrinks[Math.floor(Math.random() * allDrinks.length)].name, reason: "A classic refreshing choice to balance the flavors of your meal." }
    : null;

  if (allDrinks.length === 0) return null;

  const drinkList = allDrinks.map(d => `${d.name} (Flavor: ${d.pairing_tag || 'Neutral'})`).join(", ");

  const prompt = `
    Dish: ${dish.name} (Flavor: ${dish.pairing_tag})
    Menu: ${drinkList}
    
    Task: Pick ONE drink from the menu that goes best with this dish. 
    Even if there is no perfect match, pick the best available option.
    
    Return ONLY JSON:
    {"suggestedDrinkName": "Exact Name", "reason": "Short elegant explanation"}
  `;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Remove markdown code blocks if AI included them
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);

    // Verify the AI didn't hallucinate a fake drink
    const drinkExists = allDrinks.find(d => d.name.toLowerCase() === data.suggestedDrinkName.toLowerCase());
    
  if (drinkExists && drinkExists.name.toLowerCase() !== dish.name.toLowerCase()) {
  return { ...data, suggestedDrinkName: drinkExists.name };
}
    return defaultSuggestion;

  } catch (error) {
    console.error("Pairing Logic Error:", error);
    return defaultSuggestion; 
  }
}