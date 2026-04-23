export function trackKothZoneControl(fighter, playerNum, gameStore) {
    if (!fighter || !fighter.currentPlatform) return;
    if (fighter.currentPlatform.triggerType !== 'KOTH_ZONE') return;

    gameStore.getState().incrementKothControlFrames(playerNum, 1);
}
