import asyncio

from anthropic import RateLimitError, APITimeoutError, APIConnectionError

# Note: pydantic-ai Agent has built-in retry logic; this helper is only needed
# for raw AsyncAnthropic client calls (sync evaluator path, etc.).


async def claude_call_with_retry(
    client,
    max_retries: int = 3,
    base_delay: float = 1.0,
    **kwargs,
):
    """
    Call Claude API with exponential backoff retry.
    Retries on: RateLimitError, APITimeoutError, APIConnectionError
    Raises immediately on: all other errors (bad request, auth, etc.)
    """
    last_error = None
    for attempt in range(max_retries):
        try:
            return await client.messages.create(**kwargs)
        except (RateLimitError, APITimeoutError, APIConnectionError) as e:
            last_error = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)  # 1s, 2s, 4s
                await asyncio.sleep(delay)
            continue
        except Exception:
            raise  # don't retry on bad request, auth errors, etc.
    raise last_error
