# Temperature vs Top-p

Both sliders control randomness, but in different ways:

- **Temperature** (0-2): Higher values widen the pool of words the model considers. Think of it as adding spice.
- **Top-p** (0-1): Also called nucleus sampling. It slices off the tail of unlikely words and samples from the top chunk that sums to *p* probability.

## Guided Test

1. Keep temperature at **0.2** and top-p at **0.9**.
2. Ask for: `Write a product name for a calm productivity app.`
3. Increase temperature to **1.2** and repeat.
4. Reset temperature to **0.7**, drop top-p to **0.3**, and try again.

Notice how temperature changes style while top-p trims off adventurous picks. They work best when tuned together.

## Pro Tip

When you want reliable, formatted answers, lower both settings. For brainstorming, raise one (or both) slightly but avoid maxing them out together - it can create chaotic responses.