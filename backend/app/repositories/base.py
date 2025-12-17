from typing import Generic, TypeVar, Type, Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo import ReturnDocument
from bson import ObjectId
from app.models.base import BaseMongoModel

T = TypeVar("T", bound=BaseMongoModel)


class BaseRepository(Generic[T]):
    """Base repository providing common CRUD operations for MongoDB collections"""

    def __init__(self, database: AsyncIOMotorDatabase, collection_name: str, model_class: Type[T]):
        self.database = database
        self.collection: AsyncIOMotorCollection = database[collection_name]
        self.model_class = model_class

    async def create(self, model: T) -> T:
        """Create a new document"""
        document = model.to_dict(exclude_none=True)
        result = await self.collection.insert_one(document)
        document["_id"] = result.inserted_id
        return self.model_class.from_mongo(document)

    async def find_by_id(self, id: str | ObjectId) -> Optional[T]:
        """Find a document by ID"""
        if isinstance(id, str):
            id = ObjectId(id)
        document = await self.collection.find_one({"_id": id})
        return self.model_class.from_mongo(document) if document else None

    async def find_one(self, filter: Dict[str, Any]) -> Optional[T]:
        """Find a single document matching the filter"""
        document = await self.collection.find_one(filter)
        return self.model_class.from_mongo(document) if document else None

    async def find_many(
        self,
        filter: Dict[str, Any] = None,
        skip: int = 0,
        limit: int = 100,
        sort: List[tuple] = None
    ) -> List[T]:
        """Find multiple documents matching the filter"""
        filter = filter or {}
        cursor = self.collection.find(filter).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        documents = await cursor.to_list(length=limit)
        return [self.model_class.from_mongo(doc) for doc in documents]

    async def update_by_id(self, id: str | ObjectId, update_data: Dict[str, Any]) -> Optional[T]:
        """Update a document by ID"""
        if isinstance(id, str):
            id = ObjectId(id)

        from datetime import datetime
        update_data["updated_at"] = datetime.utcnow()

        result = await self.collection.find_one_and_update(
            {"_id": id},
            {"$set": update_data},
            return_document=ReturnDocument.AFTER
        )
        return self.model_class.from_mongo(result) if result else None

    async def delete_by_id(self, id: str | ObjectId) -> bool:
        """Delete a document by ID"""
        if isinstance(id, str):
            id = ObjectId(id)
        result = await self.collection.delete_one({"_id": id})
        return result.deleted_count > 0

    async def count(self, filter: Dict[str, Any] = None) -> int:
        """Count documents matching the filter"""
        filter = filter or {}
        return await self.collection.count_documents(filter)

    async def exists(self, filter: Dict[str, Any]) -> bool:
        """Check if a document exists matching the filter"""
        count = await self.collection.count_documents(filter, limit=1)
        return count > 0
