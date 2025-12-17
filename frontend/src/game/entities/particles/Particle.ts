export abstract class Particle{
    posX: number = 0
    posY: number = 0
    velocityX: number = 0
    velocityY: number = 0
    lifespan: number = 1000
    color: number = 0xffffff
    size: number = 5
    scale: number = 1.0
    rotation: number = 0
    alpha: number = 1.0
    shape: string = 'circle'
    
    abstract SetDefaults(): void
}