
import json
import os
from collections import defaultdict
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import psutil
import shutil
import time

nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')

BRAVE_BOOKMARKS_PATH = os.path.expanduser(
    "~/Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks"
)

def is_brave_running():
    for proc in psutil.process_iter(['name']):
        if 'Brave' in proc.info['name']:
            return True
    return False

print(f"Targeting Bookmarks file at: {BRAVE_BOOKMARKS_PATH}")
print("Welcome to Bookmark Up! Crafted by The Taxidermist at AD:HOC Codeworks—let’s mount those bookmarks beautifully!")

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
        # Use the most frequent keyword across all bookmarks as the group
        if keywords:
            # For now, pick the first keyword, but ensure duplicates cluster
            group_name = min(keywords)  # Use lexicographically smallest for consistency
        else:
            group_name = "Misc"
        groups[group_name].append(bookmark)
    # Filter out tiny groups (e.g., < 2 bookmarks) into Misc
    final_groups = defaultdict(list)
    for group_name, items in groups.items():
        if len(items) >= 2 or group_name == "Misc":
            final_groups[group_name].extend(items)
        else:
            final_groups["Misc"].extend(items)
    return final_groups

def build_new_structure(original_data, groups):
    new_data = original_data.copy()
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
    new_data["roots"]["bookmark_bar"] = new_bookmark_bar
    return new_data

def save_bookmarks(new_data):
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.expanduser(f"~/Desktop/BookmarkUp_Backup_{timestamp}.bak")
    shutil.copy(BRAVE_BOOKMARKS_PATH, backup_path)
    print(f"Backup created at: {backup_path}")
    print("Attempting to save new bookmark structure...")
    with open(BRAVE_BOOKMARKS_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_data, f, indent=2)
    print(f"Saved to {BRAVE_BOOKMARKS_PATH}! Relaunch Brave to see The Taxidermist’s handiwork!")

def main():
    if is_brave_running():
        print("WARNING: Brave is running! Close all instances of Brave to avoid stuffing things up.")
        input("Press Enter to continue once Brave is closed, or Ctrl+C to abort: ")
        if is_brave_running():
            print("Brave’s still lurking! Aborting to keep your bookmarks safe.")
            return
    data = load_bookmarks()
    bookmarks = extract_bookmarks(data["roots"]["bookmark_bar"])
    print(f"Found {len(bookmarks)} bookmarks to organize!")
    grouped_bookmarks = simple_semantic_grouping(bookmarks)
    print(f"Mounted into {len(grouped_bookmarks)} categories by AD:HOC Codeworks!")
    new_structure = build_new_structure(data, grouped_bookmarks)
    save_bookmarks(new_structure)

if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        print("Oops! The Taxidermist couldn’t find your Brave Bookmarks file. Check the path!")
    except PermissionError:
        print("Yikes! No permission to write to the Bookmarks file. Try running with sudo or check perms!")
    except Exception as e:
        print(f"Uh-oh, taxidermy gone wrong: {e}")