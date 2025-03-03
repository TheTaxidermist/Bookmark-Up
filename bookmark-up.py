import json
import os
from collections import defaultdict
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

# Download NLTK data (run once, updated for punkt_tab)
nltk.download('punkt')       # Legacy punkt resource
nltk.download('punkt_tab')   # New tokenizer resource
nltk.download('stopwords')

# Path to Brave bookmarks (Mac-specific)
BRAVE_BOOKMARKS_PATH = os.path.expanduser(
    "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks"
)

# Taxidermist’s cheesy welcome
print("Welcome to Bookmark Up! Crafted by The Taxidermist at AD:HOC Codeworks—let’s mount those bookmarks beautifully!")

def load_bookmarks():
    """Load the Brave Bookmarks JSON file."""
    with open(BRAVE_BOOKMARKS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_bookmarks(node, bookmarks_list=None):
    """Recursively extract all bookmarks from the JSON structure."""
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
    """Group bookmarks by keywords in their names."""
    stop_words = set(stopwords.words('english'))
    groups = defaultdict(list)
    for bookmark in bookmarks:
        words = word_tokenize(bookmark["name"].lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 3]
        group_name = keywords[0] if keywords else "Misc"
        groups[group_name].append(bookmark)
    return groups

def build_new_structure(groups):
    """Create a new bookmark hierarchy from grouped bookmarks."""
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
    """Save the updated structure back to the Bookmarks file."""
    with open(BRAVE_BOOKMARKS_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2)
    print("Bookmarks stuffed and mounted! Check Brave for The Taxidermist’s handiwork!")

def main():
    data = load_bookmarks()
    bookmarks = extract_bookmarks(data["roots"]["bookmark_bar"])
    print(f"Found {len(bookmarks)} bookmarks to organize!")
    grouped_bookmarks = simple_semantic_grouping(bookmarks)
    print(f"Mounted into {len(grouped_bookmarks)} categories by AD:HOC Codeworks!")
    new_structure = build_new_structure(grouped_bookmarks)
    save_bookmarks(new_structure)

if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        print("Oops! The Taxidermist couldn’t find your Brave Bookmarks file. Check the path!")
    except Exception as e:
        print(f"Uh-oh, taxidermy gone wrong: {e}")