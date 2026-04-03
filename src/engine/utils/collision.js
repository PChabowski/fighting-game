export function rectangularCollision({ rectangle1, rectangle2 }) {
    return (
        rectangle1.attackBox.position.x + rectangle1.attackBox.width >= rectangle2.position.x &&
        rectangle1.attackBox.position.x <= rectangle2.position.x + rectangle2.width &&
        rectangle1.attackBox.position.y + rectangle1.attackBox.height >= rectangle2.position.y &&
        rectangle1.attackBox.position.y <= rectangle2.position.y + rectangle2.height
    )
}

export function detectPlatformCollision(fighter, platforms) {
    let onPlatform = false;
    let standingY = null;
    
    // Calculate fighter bottom line (where feet are)
    const fighterBottom = fighter.position.y + fighter.height;

    for (let platform of platforms) {
        // Zwykła, twarda platforma, która zablokuje spadek:
        // By wpaść "na" platformę: 
        // 1. Spadamy (velocity.y >= 0)
        // 2. Dół fightera musi być mniej-więcej nad platformą w poprzedniej klatce (wybiórcze, lub po prostu zablokujmy przenikanie z góry)
        // 3. Pozycja X musi zgadzać się z platformą
        
        const isWithinX =
            fighter.position.x + fighter.width >= platform.x &&
            fighter.position.x <= platform.x + platform.width;

        // Jeśli spodziewamy się kolizji z góry platformy w dół:
        const wasAbove = fighterBottom - fighter.velocity.y <= platform.y;
        const goesBelow = fighterBottom >= platform.y;

        if (fighter.velocity.y >= 0 && isWithinX && wasAbove && goesBelow) {
            onPlatform = true;
            standingY = platform.y;
            break;
        }
    }
    
    return { onPlatform, standingY };
}
