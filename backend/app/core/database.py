from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


class MongoDB:
    client: AsyncIOMotorClient = None
    database: AsyncIOMotorDatabase = None


mongodb = MongoDB()


async def connect_to_mongo():
    """Connect to MongoDB on application startup"""
    mongodb.client = AsyncIOMotorClient(settings.mongodb_url)
    mongodb.database = mongodb.client[settings.mongodb_database]
    print(f"Connected to MongoDB database: {settings.mongodb_database}")


async def close_mongo_connection():
    """Close MongoDB connection on application shutdown"""
    if mongodb.client:
        mongodb.client.close()
        print("Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance"""
    return mongodb.database
