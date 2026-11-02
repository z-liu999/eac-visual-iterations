"""Auditable preliminary text categories, without claiming visual verification."""
import re
from functools import lru_cache

CATEGORIES = {
    1: {'label': 'Noise / numbers', 'color': '#C83FE8'},
    2: {'label': 'Observable labels', 'color': '#1685F8'},
    3: {'label': 'Scene speculation', 'color': '#F27622'},
    4: {'label': 'Unrelated content', 'color': '#35B85A'},
}
VERSION = 'text-rules-v1'

SCENE = re.compile(r'\b(man|men|woman|women|girl|boy|child|children|baby|person|people|crowd|guy|lady|couple|tourist|cleaner|performer|police|bus|buses|taxi|cab|truck|car|van|bike|bicycle|cyclist|pigeon|bird|dog|cat|fountain|statue|monument|street|road|square|crossing|traffic|light|hat|coat|shirt|scarf|umbrella|bag|phone|camera|photo|selfie|red|blue|green|yellow|white|black|walking|walks|running|runs|waiting|standing|sitting|smoking|eating|drinking|dancing|looking|cross|crosses|crossing|cycling|cleaning|kissing|hugging|taking|photograph|photography|piccadilly|london|homme|femme|gens|voiture|rue|oiseau|personne|chapeau|photo|hombre|mujer|coche|calle|persona|pájaro|pessoa|mulher|homem|rua|auto|mann|frau|menschen|vogel|straße)\b|人|男|女|孩|行人|游客|工人|清洁|鸽|鳥|鸟|狗|车|車|街|路|广场|廣場|雕像|喷泉|衣|帽|围巾|伞|包|手机|相机|拍照|摄影|等待|走路|跑步|吸烟|吃|跳舞|电话|ロンドン|バス|写真|歩|待|사람|남자|여자|버스', re.I)
INFERENCE = re.compile(r'\b(think|thinking|thought|maybe|probably|perhaps|seems?|apparently|suspect|suspicious|wonder|wonders|wondering|imagine|imagining|pretend|pretending|wish|wishes|wants?|trying|hopes?|must|might|could|would|bored|confused|lonely|lost|sad|happy|angry|drunk|stoned|spy|spying|secret|invisible|alien|aliens|zombie|dragon|unicorn|witch|wizard|ghost|superhero|tinder|problems)\b|looks? like|going to|waiting for (?:my|his|her|their|a friend|someone|somebody)|可能|也许|也許|大概|好像|似乎|我猜|假装|假裝|想象|想像|如果|是不是|一定是|应该|應該|无聊|孤独|外星|魔法|隐形|隱形|peut.être|semble|vielleicht|parece', re.I)
OFFTOPIC = re.compile(r'https?://|www\.|\b(subscribe|follow me|instagram|youtube|tiktok|facebook|snapchat|bitcoin|crypto|discount|promo|password|email|hello|hi|hey|greetings|welcome|test|testing|asdf|lorem ipsum|happy birthday|i love you|i was here|i am here|i am watching|i.m watching|can anyone|does anyone|anybody here|who is watching|watching this|my name is|once upon a time|far far away)\b|你好|大家好|测试|測試|打卡|我爱你|我愛你|关注|关注我|訂閱|订阅|加微信|曾经有|很久以前|从前|從前|こんにちは|안녕|\b(bonjour|salut|hola|ciao|hallo|olá|oi|merhaba|selamat|terima)\b', re.I)
PRONOUN = re.compile(r'\b(he|she|they|his|her|their|this|that|him|them)\b|他|她|他们|她们|这个|這個|那个人', re.I)
FIRST_PERSON_ANIMAL = re.compile(r"\b(i am|i'm|im|i’m) (?:a |the )?(?:pigeon|bird|bus|statue|cat|dog)\b", re.I)
KEYBOARD = re.compile(r'^(?:[asdfghjklqwertyuiopzxcvbnm]{7,})$', re.I)

@lru_cache(maxsize=30000)
def classify(text):
    text = str(text or '').strip()
    folded = text.casefold()
    def result(category, confidence, reason):
        return {'category': category, 'confidence': confidence, 'reason': reason,
                'needsReview': confidence < .7, 'method': VERSION}
    if not text or not any(c.isalpha() for c in text):
        return result(1, .98, 'Only numbers, punctuation, symbols, or whitespace')
    compact = re.sub(r'\s', '', folded)
    if re.fullmatch(r'(.)\1{3,}', compact) or re.fullmatch(r'(\w{1,3})\1{3,}', compact):
        return result(1, .91, 'Repeated characters or repeated short fragments')
    if folded in {'asdf', 'asdfgh', 'qwerty', 'lololol', 'jknhbyg', 'tygh', 'bla', 'blabla', 'blah', 'hmmm', '!!'}:
        return result(1, .85, 'Recognized filler or keyboard sequence')
    if KEYBOARD.fullmatch(compact) and not re.search(r'[aeiouy]', compact):
        return result(1, .8, 'Long consonant-only keyboard sequence')
    scene = bool(SCENE.search(text))
    speculation = bool(INFERENCE.search(text))
    if FIRST_PERSON_ANIMAL.search(text):
        return result(3, .87, 'Imagined first-person role assigned to a scene subject')
    if OFFTOPIC.search(text):
        if scene and speculation:
            return result(3, .64, 'Mixed conversational text and speculation about a scene subject')
        if scene:
            return result(4, .54, 'Conversation or external reference mixed with a scene word; ambiguous')
        return result(4, .86, 'Greeting, personal message, external link, test, or unrelated story marker')
    if speculation and (scene or PRONOUN.search(text)):
        return result(3, .78, 'Intent, mental state, hypothetical action, or fantasy attributed to a subject')
    if scene:
        return result(2, .8, 'Concrete scene object, appearance, place, or visible action; image not verified')
    if speculation:
        return result(3, .46, 'Subjective or hypothetical language without a clear scene anchor')
    if re.fullmatch(r'[A-Za-z]{1,3}', text) and folded not in {'yes', 'no', 'oui', 'non', 'si', 'sí', 'ja', 'nee', 'ok', 'hey', 'bye', 'wow'}:
        return result(1, .38, 'Very short fragment; meaning uncertain')
    return result(4, .25, 'No recognized scene anchor; language/context needs human review, not proof of irrelevance')
