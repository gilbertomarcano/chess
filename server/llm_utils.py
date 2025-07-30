# llm_utils.py

from .config import LLM_MODEL_NAME, LLM_MAX_TOKENS_FOR_GENERATION, LLM_TEMP
from mlx_lm import load, generate
from mlx_lm.sample_utils import make_sampler, make_logits_processors
from .xml_constraint import XMLTagConstraint

llm_model = None
llm_tokenizer = None
xml_lp = None
lps = None


def load_llm():
    global llm_model, llm_tokenizer, xml_lp, lps
    llm_model, llm_tokenizer = load(LLM_MODEL_NAME)
    
    TAGS = ["<think>", "</think>", "<reasoning>", "</reasoning>",
        "<answer>", "</answer>"]

    # Encode each tag with the model’s tokenizer (DeepSeek-R1 uses Llama-style BPE)
    tag_ids = {tag: llm_tokenizer.encode(tag, add_special_tokens=False) for tag in TAGS}

    # Inspect
    for tag, ids in tag_ids.items():
        print(f"{tag:13} → {ids}")
        
    # Build the custom logits‐processor
    xml_lp = XMLTagConstraint(llm_tokenizer, tag_ids)
    
    # Chain with built-in processors
    base_lps = make_logits_processors()
    lps = base_lps + [xml_lp]


def is_llm_loaded():
    return llm_model is not None and llm_tokenizer is not None

def generate_llm_reply(user_message: str) -> str:
    prompt = """<think>"""
    # prompt = f"User: {user_message}\nAssistant:"
    sampler = make_sampler(temp=LLM_TEMP)
    response_text = generate(
        llm_model,
        llm_tokenizer,
        prompt=prompt,
        max_tokens=512,
        sampler=sampler,
        logits_processors=lps,
        verbose=False
    )
    if response_text.startswith(prompt):
        llm_reply = response_text[len(prompt):].strip()
    else:
        llm_reply = response_text.strip()
    return llm_reply
