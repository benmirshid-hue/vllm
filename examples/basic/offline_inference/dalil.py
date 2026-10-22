# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""دليل: إعادة إنتاج رد عربي ثابت، ثم بناء خطة أصلية."""

import torch
from vllm import LLM, EngineArgs, SamplingParams
from vllm.outputs import RequestOutput
from vllm.utils.argparse_utils import FlexibleArgumentParser

REPRODUCE_MESSAGES = [
    {
        "role": "system",
        "content": "أجب بالعربية الفصحى فقط، وبجملة واحدة.",
    },
    {
        "role": "user",
        "content": "قل: مرحبا، أنا وكيل vLLM.",
    },
]

CONSTRUCT_PROMPT = (
    "الموضوع: حديقة صغيرة في الرياض.\n"
    "اكتب أربعة أسطر جديدة فقط، سطراً لكل بند، من غير اعتذار:\n"
    "البناء:\n"
    "الفيديو:\n"
    "الصوت:\n"
    "الصور:"
)


def create_parser() -> FlexibleArgumentParser:
    parser = FlexibleArgumentParser(description="دليل الوكيل العربي")
    EngineArgs.add_cli_args(parser)
    parser.set_defaults(model="Qwen/Qwen2.5-0.5B-Instruct")
    if not torch.cuda.is_available():
        parser.set_defaults(
            dtype="bfloat16",
            max_model_len=1024,
            enforce_eager=True,
        )
    parser.add_argument(
        "--task",
        choices=("reproduce", "construct", "all"),
        default="all",
        help="reproduce لإعادة الإنتاج، construct للبناء، all للاثنين",
    )
    parser.add_argument("--image-url", default=None, help="رابط صورة")
    parser.add_argument("--audio-url", default=None, help="رابط صوت")
    parser.add_argument("--video-url", default=None, help="رابط فيديو")
    parser.add_argument("--max-tokens", type=int, default=256, help="حد الرموز")
    return parser


def _media_parts(args: dict) -> list[dict]:
    parts = []
    if args["image_url"]:
        parts.append(
            {
                "type": "image_url",
                "image_url": {"url": args["image_url"]},
            }
        )
    if args["audio_url"]:
        parts.append(
            {
                "type": "audio_url",
                "audio_url": {"url": args["audio_url"]},
            }
        )
    if args["video_url"]:
        parts.append(
            {
                "type": "video_url",
                "video_url": {"url": args["video_url"]},
            }
        )
    return parts


def _user_content(text: str, media: list[dict]) -> str | list[dict]:
    if not media:
        return text
    return [{"type": "text", "text": text}, *media]


def _print_output(title: str, output: RequestOutput) -> str:
    text = output.outputs[0].text.strip()
    print("\n" + title)
    print("-" * 60)
    print(text)
    print("-" * 60)
    return text


def main(args: dict) -> None:
    task = args.pop("task")
    image_url = args.pop("image_url")
    audio_url = args.pop("audio_url")
    video_url = args.pop("video_url")
    max_tokens = args.pop("max_tokens")
    media = _media_parts(
        {
            "image_url": image_url,
            "audio_url": audio_url,
            "video_url": video_url,
        }
    )

    llm = LLM(**args)
    if task in ("reproduce", "all"):
        reproduce = llm.chat(
            REPRODUCE_MESSAGES,
            SamplingParams(temperature=0.0, max_tokens=32),
            use_tqdm=False,
        )
        text = _print_output("إعادة الإنتاج", reproduce[0])
        if not any("\u0600" <= ch <= "\u06ff" for ch in text):
            raise SystemExit("إعادة الإنتاج لم تُعد نصاً عربياً.")

    if task in ("construct", "all"):
        messages = [
            {
                "role": "system",
                "content": "أنت وكيل بناء. اكتب بالعربية الفصحى فقط.",
            },
            {
                "role": "user",
                "content": _user_content(CONSTRUCT_PROMPT, media),
            },
        ]
        constructed = llm.chat(
            messages,
            SamplingParams(temperature=0.2, max_tokens=max_tokens),
            use_tqdm=False,
        )
        text = _print_output("البناء الأصلي", constructed[0])
        if not any("\u0600" <= ch <= "\u06ff" for ch in text):
            raise SystemExit("البناء الأصلي لم يُعد نصاً عربياً.")


if __name__ == "__main__":
    parser = create_parser()
    main(vars(parser.parse_args()))
