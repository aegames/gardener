import { getGameScene } from './database';
import { Area, Game, GameVariableBase, Scene } from './game';
import { ManagedGuild } from './managedGuild';

export function getSceneIndex<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(game: Game<VariableType, AreaType, SceneType>, scene: SceneType) {
  return game.scenes.findIndex((s) => s.name === scene.name);
}

export async function findScene<
  VariableType extends GameVariableBase,
  AreaType extends Area<VariableType>,
  SceneType extends Scene<VariableType, AreaType>
>(
  managedGuild: ManagedGuild,
  game: Game<VariableType, AreaType, SceneType>,
  sceneIdentifier: string,
) {
  if (sceneIdentifier === 'next' || sceneIdentifier === 'previous') {
    const currentScene = await getGameScene(managedGuild, game);
    if (currentScene == null) {
      throw new Error('There is no active scene right now.');
    }

    const sceneIndex = getSceneIndex(game, currentScene);
    if (sceneIndex === -1) {
      throw new Error('Current scene not found in scene order!');
    }

    const targetIndex = sceneIndex + (sceneIdentifier === 'next' ? 1 : -1);
    if (targetIndex < 0) {
      throw new Error('This is the first scene in the game.');
    }

    if (targetIndex >= game.scenes.length) {
      throw new Error('This is the last scene in the game.');
    }

    return game.scenes[targetIndex];
  } else if (sceneIdentifier === 'first') {
    return game.scenes[0];
  } else if (sceneIdentifier === 'last') {
    return game.scenes[game.scenes.length - 1];
  } else {
    const scene = game.scenes.find(
      (scene) => scene.name.toLowerCase() === sceneIdentifier.toLowerCase(),
    );
    if (scene == null) {
      throw new Error(`Scene not found: "${sceneIdentifier}"`);
    }

    return scene;
  }
}
