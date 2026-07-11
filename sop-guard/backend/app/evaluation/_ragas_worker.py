"""
RAGAS worker subprocess.
-------------------------
ragas.evaluate() manages its own event loop internally (via nest_asyncio)
and is not safe to call from inside an already-running asyncio loop - on
this stack (Python 3.14 + ragas 0.2.x) it corrupts the parent loop's
executor shutdown rather than raising a clean error. Running it in a
dedicated subprocess with no parent event loop sidesteps that entirely:
this script is invoked as `python -m app.evaluation._ragas_worker`, reads
a JSON job from stdin, runs the real evaluation top-level (no nesting),
and writes a JSON result to stdout. Not intended to be imported directly.
"""

import json
import sys


def main() -> None:
    job = json.loads(sys.stdin.read())
    rows = job["rows"]
    model = job["model"]
    base_url = job["base_url"]
    embedding_model = job["embedding_model"]

    try:
        from langchain_ollama import ChatOllama
        from langchain_huggingface import HuggingFaceEmbeddings
        from ragas import evaluate, EvaluationDataset
        from ragas.llms import LangchainLLMWrapper
        from ragas.embeddings import LangchainEmbeddingsWrapper
        from ragas.metrics import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithoutReference
        from ragas.run_config import RunConfig

        chat = ChatOllama(model=model, base_url=base_url, temperature=0.0)
        embed = HuggingFaceEmbeddings(model_name=embedding_model)
        judge_llm = LangchainLLMWrapper(chat)
        judge_embeddings = LangchainEmbeddingsWrapper(embed)

        dataset = EvaluationDataset.from_list(rows)
        metrics = [Faithfulness(), ResponseRelevancy(), LLMContextPrecisionWithoutReference()]
        run_config = RunConfig(timeout=20, max_retries=1, max_wait=5)
        scored = evaluate(
            dataset=dataset, metrics=metrics,
            llm=judge_llm, embeddings=judge_embeddings, run_config=run_config,
        )
        df = scored.to_pandas()
        records = json.loads(df.to_json(orient="records"))
        print(json.dumps({"ok": True, "records": records}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))


if __name__ == "__main__":
    main()
