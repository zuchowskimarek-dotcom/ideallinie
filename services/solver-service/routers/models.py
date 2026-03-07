from fastapi import APIRouter, HTTPException

from car_dynamics import MODEL_REGISTRY, create_model

router = APIRouter()


@router.get("/")
async def list_models():
    """List all available car dynamics models."""
    return {"models": list(MODEL_REGISTRY.keys())}


@router.get("/{model_id}")
async def get_model_info(model_id: str):
    """Get default config for a specific model."""
    try:
        model = create_model(model_id)
        return {
            "modelId": model.model_id,
            "config": model.config,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
