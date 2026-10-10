# Browser Boss-Fight Game (Player vs Gemini AI Boss)

A real-time 2D browser arena boss-fight game where the boss's tactical combat decisions and taunts are powered by Google's Gemini API via a secure backend gateway.

## Quick Start (4 Steps)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Add key to `.env`**:
   Copy `.env.example` to `.env` (or edit `.env`) and set your Google AI Studio API key:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   PORT=3000
   ```

3. **Drop characters into `assets/characters`**:
   Place transparent PNGs (facing right) into `public/assets/characters/`:
   - `public/assets/characters/player.png`
   - `public/assets/characters/boss.png`
   *(Optional: If no images are provided, the game automatically uses sleek colored placeholder rectangles without crashing).*

4. **Run the game**:
   ```bash
   npm start
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Controls
- **Move**: `A` / `D` or `Arrow Left` / `Arrow Right`
- **Jump**: `W` / `Space` / `Arrow Up`
- **Attack**: `J` (stamina cost: 15)
- **Block**: `K` (reduces damage by 80%, stamina cost on hit)
- **Dash / Dodge**: `L` (invulnerability frames, stamina cost: 25, 1.2s cooldown)
