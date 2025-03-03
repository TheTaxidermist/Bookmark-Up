import json
import os
from collections import defaultdict
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Download NLTK data (run once)
nltk.download('punkt')
nltk.download('stopwords')

# Path to Brave bookmarks (Mac-specific)
BRAVE_BOOKMARKS_PATH = os.path.expanduser(
    "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks"
)

print("Welcome to Bookmark Up! Let’s spruce up those bookmarks, eh?")

def load_bookmarks():
    with open(BRAVE_BOOKMARKS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_bookmarks(node, bookmarks_list=None):
    if bookmarks_list is None:
        bookmarks_list = []
    if "children" in node:
        for child in node["children"]:
            if child["type"] == "url":
                bookmarks_list.append(child)
            elif child["type"] == "folder":
                extract_bookmarks(child, bookmarks_list)
    return bookmarks_list

def simple_semantic_grouping(bookmarks):
    stop_words = set(stopwords.words('english'))
    groups = defaultdict(list)
    for bookmark in bookmarks:
        words = word_tokenize(bookmark["name"].lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 3]
        group_name = keywords[0] if keywords else "Misc"
        groups[group_name].append(bookmark)
    return groups

def build_new_structure(groups):
    new_bookmark_bar = {
        "children": [],
        "name": "Bookmark Bar",
        "type": "folder"
    }
    for group_name, bookmarks in groups.items():
        folder = {
            "children": bookmarks,
            "name": f"Up {group_name.capitalize()}",
            "type": "folder",
            "date_added": bookmarks[0]["date_added"]
        }
        new_bookmark_bar["children"].append(folder)
    return {
        "roots": {
            "bookmark_bar": new_bookmark_bar,
            "other": {"children": [], "name": "Other Bookmarks", "type": "folder"},
            "synced": {"children": [], "name": "Synced Bookmarks", "type": "folder"}
        }
    }

def save_bookmarks(new_data):
    with open(BRAVE_BOOKMARKS_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2)
    print("Bookmarks updated! Check out your shiny new structure in Brave!")

def main():
    data = load_bookmarks()
    bookmarks = extract_bookmarks(data["roots"]["bookmark_bar"])
    print(f"Found {len(bookmarks)} bookmarks to organize!")
    grouped_bookmarks = simple_semantic_grouping(bookmarks)
    print(f"Grouped into {len(grouped_bookmarks)} categories!")
    new_structure = build_new_structure(grouped_bookmarks)
    save_bookmarks(new_structure)

if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        print("Oops! Couldn’t find your Brave Bookmarks file. Check the path!")
    except Exception as e:
        print(f"Uh-oh, something went wonky: {e}")